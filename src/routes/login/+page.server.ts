import { redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { z } from "zod";
import { setError, superValidate, fail } from "sveltekit-superforms";
import { zod4 as zod } from "sveltekit-superforms/adapters";
import { getSafeRedirectTarget } from "$lib/safeRedirect";

const LoginPageSchema = z.object({
	email: z.string().trim().toLowerCase().email(),
	password: z.string().min(6).max(64)
});

export const load = async ({ locals, request, url }) => {
	// Server API:
	const form = await superValidate(zod(LoginPageSchema));

	if (locals.user) {
		// if logged in, redirect to home
		throw redirect(303, "/");
	}

	return { form }; // Unless you throw, always return { form } in load and form actions.
};

export const actions: Actions = {
	default: async ({ locals, request, url }) => {
		const form = await superValidate(request, zod(LoginPageSchema));
		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await locals.pb.collection("users").authWithPassword(form.data.email, form.data.password);
		} catch (error: unknown) {
			const status = (error as { status?: number }).status;
			if (status === 429) {
				return setError(form, "", "Too many sign-in attempts. Wait a few seconds and try again.");
			}
			if (!status || status >= 500) {
				return setError(form, "", "Sign-in is busy right now. Wait a few seconds and try again.");
			}
			return setError(form, "", "Incorrect email or password.");
		}

		const redirectTo = url.searchParams.get("redirectTo");
		throw redirect(303, getSafeRedirectTarget(redirectTo, url.origin));
	}
};
