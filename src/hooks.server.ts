import type { RecievedUser } from "$lib/db_types";
import { isOnCommittee } from "$lib/isOnCommittee";
import { env } from "$env/dynamic/public";
import { redirect, type Handle } from "@sveltejs/kit";
import PocketBase from "pocketbase";

export const handle: Handle = async ({ event, resolve }) => {
	// Auth state belongs to a single request. Reusing the browser-side PocketBase
	// singleton here lets concurrent requests overwrite each other's auth store.
	const pb = new PocketBase(env.PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090");

	// before
	pb.authStore.loadFromCookie(event.request.headers.get("cookie") || "");
	if (pb.authStore.isValid) {
		try {
			await pb.collection("users").authRefresh({ requestKey: null });
		} catch (_) {
			pb.authStore.clear();
		}
	}

	event.locals.pb = pb;
	event.locals.user = structuredClone(pb.authStore.model);

	if (event.url.pathname.startsWith("/events") || event.url.pathname.startsWith("/settings") || event.url.pathname.startsWith("/tutoring") || event.url.pathname.startsWith("/apply")) {
		if (!event.locals.user) { // if not logged in, redirect
			// Redirection inspired by https://www.youtube.com/watch?v=ieECVME5ZLU
			const fromUrl = event.url.pathname + event.url.search;
			let message = "You must be logged in to access that page.";
			if (event.url.pathname.startsWith("/apply")) {
				message = "Prospective ARISTA applicants must first register as a tutee before filling out the application. Only current freshmen, sophomores, and junior Stuyvesant students with a 92 overall GPA (no exceptions will be made, not even if you are a tenth off) are eligible to apply.";
				throw redirect(303, `/register?redirectTo=${fromUrl}&message=${message}`);
			}
			if (event.url.pathname.startsWith("/tutoring")) {
				message = "Looking to get tutored? Register for a tutee account below and submit your request!";
				throw redirect(303, `/register?redirectTo=${fromUrl}&message=${message}`);
			}
			throw redirect(303, `/login?redirectTo=${fromUrl}&message=${message}`);
		}
	}

	if ((event.url.pathname.startsWith("/events")) && event.locals.user && event.locals.user.is_tutee) {
		// Redirection inspired by https://www.youtube.com/watch?v=ieECVME5ZLU
		const fromUrl = event.url.pathname + event.url.search;
		const message = "Tutees cannot access that page.";
		throw redirect(303, `/login?redirectTo=${fromUrl}&message=${message}`);
	}

	if ((event.url.pathname.startsWith("/apply")) && event.locals.user && !event.locals.user.is_tutee) {
		throw redirect(303, `/`); // current arista members can't access the application page
	}

	// Forbid non-admins from entering admin routes
	if (event.url.pathname.startsWith("/admin")) {
		if (!event.locals.user) {
			const fromUrl = event.url.pathname + event.url.search;
			const message = "You must be logged in to access the admin panel.";
			throw redirect(303, `/login?redirectTo=${fromUrl}&message=${message}`);
		}
		if (!isOnCommittee(event.locals.user as RecievedUser, "admin") && !isOnCommittee(event.locals.user as RecievedUser, "operations")) {
			const fromUrl = event.url.pathname + event.url.search;
			const message = "Non-admins cannot access that page.";
			throw redirect(303, `/login?redirectTo=${fromUrl}&message=${message}`);
		}
	}

	const response = await resolve(event);

	// after
	response.headers.set("set-cookie", pb.authStore.exportToCookie({ httpOnly: false }));

	return response;
};
