import { fail } from "@sveltejs/kit";
import type { Actions, ServerLoad } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { z } from "zod";
import { zod4 as zod } from "sveltekit-superforms/adapters";
import handleError from "$lib/handleError";

const ForgotPasswordSchema = z.object({
	email: z.string().trim().toLowerCase().email()
});

// Simple in-memory rate limiting
const rateLimit = new Map<string, number>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 3;

export const load: ServerLoad = async () => {
	const form = await superValidate(zod(ForgotPasswordSchema));
	return { form };
};

export const actions: Actions = {
	default: async ({ locals, request, url }: { locals: App.Locals; request: Request; url: URL }) => {
		const form = await superValidate(request, zod(ForgotPasswordSchema));
		if (!form.valid) {
			return fail(400, { form });
		}

		// Rate limiting check
		const ip = request.headers.get("x-forwarded-for") || "unknown";
		const now = Date.now();
		const userRequests = rateLimit.get(ip) || 0;

		if (userRequests >= MAX_REQUESTS) {
			return fail(429, { form, message: "Too many requests. Please try again later." });
		}

		rateLimit.set(ip, userRequests + 1);
		setTimeout(() => rateLimit.delete(ip), RATE_LIMIT_WINDOW);

		try {
			await locals.pb.collection("users").requestPasswordReset(form.data.email);
			return {
				form,
				message: "If an account with that email exists, a reset link has been sent."
			};
		} catch (error: unknown) {
			return handleError(error, form);
		}
	}
};
