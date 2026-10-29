import { fail, redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { superValidate } from "sveltekit-superforms";
import { z } from "zod";
import { zod4 as zod } from "sveltekit-superforms/adapters";
import { UserSchema, type RecievedUser } from "$lib/db_types";
import handleError from "$lib/handleError";
import { getSafeRedirectTarget } from "$lib/safeRedirect";

const RegisterPageSchema = UserSchema.merge(
	z.object({
		graduationYear: z
			.number()
			.min(2023)
			.max(2999)
			.default("" as unknown as number),
		osis: z
			.number({ message: "Enter your 9-digit OSIS number." })
			.int("Enter your 9-digit OSIS number.")
			.min(100000000, "OSIS numbers are 9 digits.")
			.max(999999999, "OSIS numbers are 9 digits.")
			.default("" as unknown as number),
		homeroom: z
			.string()
			.trim()
			.toUpperCase()
			.regex(/^[0-9][A-Z]{2}$/, "Enter your homeroom as a number and two letters, like 5JA."),
		preferredName: z
			.string()
			.trim()
			.max(32, "Keep your preferred name under 32 characters.")
			.optional(),
		password: z.string().min(6).max(64),
		passwordConfirm: z.string().min(6).max(64)
	})
)
	.omit({ committees: true })
	.refine((data) => data.password === data.passwordConfirm, {
		message: "Passwords don't match"
	});

export const load = async ({ locals, request, url }) => {
	// Server API:
	const form = await superValidate(zod(RegisterPageSchema));

	if (locals.user) {
		// if logged in, redirect to home
		throw redirect(303, "/");
	}

	// Unless you throw, always return { form } in load and form actions.
	return { form };
};

export const actions: Actions = {
	default: async ({ locals, request, url }) => {
		// Accept OSIS numbers typed with spaces, dashes, or full-width digits.
		const data = await request.formData();
		const osis = data.get("osis");
		if (typeof osis === "string") data.set("osis", osis.normalize("NFKC").replace(/\D/g, ""));
		const form = await superValidate(data, zod(RegisterPageSchema));
		// Convenient validation check:
		if (!form.valid) {
			// Again, return { form } and things will just work.
			return fail(400, { form });
		}

		form.data.member = false; // New sign-ups begin as tutees.

		try {
			await locals.pb.collection<RecievedUser>("users").create(form.data);
		} catch (error: unknown) {
			const data = (error as { response?: { data?: Record<string, { code?: string }> } })?.response
				?.data;
			const message = (error as { response?: { message?: string } })?.response?.message ?? "";
			if (data?.email?.code === "validation_not_unique" || /already exists/i.test(message)) {
				return handleError("An account with that email already exists. Try signing in.", form);
			}
			if (data && Object.keys(data).length > 0) {
				return handleError("Some details weren't accepted. Check the form and try again.", form);
			}
			return handleError("We couldn't create your account right now. Try again in a minute.", form);
		}
		try {
			await locals.pb.collection("users").authWithPassword(form.data.email, form.data.password);
		} catch {
			// The account exists now, so send them to sign in rather than signing up again.
			throw redirect(
				303,
				"/login?message=" + encodeURIComponent("Your account was created. Sign in to continue.")
			);
		}
		const redirectTo = url.searchParams.get("redirectTo");
		throw redirect(303, getSafeRedirectTarget(redirectTo, url.origin));
		// return { form };
	}
};
