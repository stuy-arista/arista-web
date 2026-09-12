import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { setError, superValidate } from "sveltekit-superforms";
import { ApplicationSchema, type RecievedApplication, type RecievedEvent } from "$lib/db_types";
import handleError from "$lib/handleError";
import { zod } from 'sveltekit-superforms/adapters';
import type Client from "pocketbase";
import type { z } from "zod";

let InProgressApplicationSchema = ApplicationSchema.partial();

async function getUserApplication(pb: Client, applicant_id: string): Promise<RecievedApplication | undefined> {
    // has user applied before? 
    const applications = await pb.collection("applications").getFullList({ filter: `applicant="${applicant_id}"` }) as unknown as RecievedApplication[]; // should only be able to see your own application
    return applications.length > 0 ? applications[0] : undefined;
}

async function createOrUpdateApplication(pb: Client, applicant_id: string, application: z.infer<typeof InProgressApplicationSchema>) {
    let userApplication = await getUserApplication(pb, applicant_id);

    let body: Partial<RecievedApplication> = {
        ...application,
        applicant: applicant_id,
        submitted: false
    };

    if (!userApplication) {
        return await pb.collection("applications").create(body) as unknown as RecievedApplication;
    }
    // else, update
    return await pb.collection("applications").update(userApplication.id, body, {}) as unknown as RecievedApplication;
}

export const load = async ({ locals }) => {
    // Server API:
    if (!locals.user) {
        error(401, "User not logged in.");
    }

    let userApplication = await getUserApplication(locals.pb, locals.user.id);

    const form = await superValidate(userApplication, zod(InProgressApplicationSchema));

    return { form, userApplication }; // Unless you throw, always return { form } in load and form actions.
};


export const actions: Actions = {
    save_application: async ({ locals, request, url }) => {
        const form = await superValidate(request, zod(InProgressApplicationSchema));

        if (!locals.user) {
            error(401, "User not logged in.");
        }

        // Convenient validation check:
        if (!form.valid) {
            // Again, return { form } and things will just work.
            return fail(400, { form });
        }


        let new_application = await createOrUpdateApplication(locals.pb, locals.user.id, form.data);

        let newForm = await superValidate(form.data, zod(InProgressApplicationSchema));


        return { form: newForm };

    },
    submit_application: async ({ locals, request, url }) => {
        let formData = Object.fromEntries(await request.formData());
        formData["extracurriculars"] = JSON.parse(formData["extracurriculars"] as any as string); // get back to json

        if (!locals.user) {
            error(401, "User not logged in.");
        }

        let safe_parsed_application = ApplicationSchema.safeParse(formData);

        if (!safe_parsed_application.success) {
            console.log(safe_parsed_application.error);
            error(400, "Application is incomplete or is improperly formatted.");
        }

        let new_application = await createOrUpdateApplication(locals.pb, locals.user.id, formData);

        // now mark it as submitted
        await locals.pb.collection("applications").update(new_application.id, {
            submitted: true,
            submitted_time: new Date().toISOString() // uploads UTC time, DB reads UTC time, marked as UTC time, all good
        }, {}) as unknown as RecievedApplication;

        return { success: true };
    }
};
