import { error, fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { superValidate } from "sveltekit-superforms";
import { EventSchema } from "$lib/db_types";
import handleError from "$lib/handleError";
import { isOnCommittee } from "$lib/isOnCommittee";
import { zod4 as zod } from "sveltekit-superforms/adapters";

export const load = async () => {
	// Server API:
	const form = await superValidate(zod(EventSchema));
	return { form }; // Unless you throw, always return { form } in load and form actions.
};

export const actions: Actions = {
	create_event: async ({ locals, request }) => {
		const form = await superValidate(request, zod(EventSchema));

		if (!locals?.user?.id || !isOnCommittee(locals.user, "events")) {
			error(403, "You do not have permission to create events.");
		}

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			form.data.start_time.setSeconds(0); // remove any issues with seconds causing credits to be inaccurate
			form.data.end_time.setSeconds(0); // remove any issues with seconds causing credits to be inaccurate
			await locals.pb
				.collection("events")
				.create({ ...form.data, signed_up: [locals.user.id], event_owner: locals.user.id });
		} catch (error: unknown) {
			console.error(error);
			return handleError(error, form);
		}

		return { form };
	}
};

//
