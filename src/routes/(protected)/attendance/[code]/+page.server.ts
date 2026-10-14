import { error, fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

type SelfMeeting = {
	name: string;
	opensAt: string;
	closesAt: string;
	open: boolean;
	member: boolean;
	checkedInAt: string | null;
};

// Members check in to a "their own phones" meeting through its QR link.
// PocketBase checks the code, the time window, membership and duplicates.
export const load = (async ({ locals, params }) => {
	try {
		const meeting = (await locals.pb.send(
			`/api/arista/attendance/self/${encodeURIComponent(params.code)}`,
			{ requestKey: null }
		)) as SelfMeeting;
		return { meeting, name: locals.user?.preferredName || locals.user?.name || "" };
	} catch {
		error(404, "This check-in link isn't valid. Ask an officer for the right QR code.");
	}
}) satisfies PageServerLoad;

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const photo = (await request.formData()).get("photo");
		if (!(photo instanceof File) || photo.size === 0) {
			return fail(400, { checkInError: "Take a photo first." });
		}
		const body = new FormData();
		body.set("photo", photo, "check-in.jpg");
		try {
			await locals.pb.send(`/api/arista/attendance/self/${encodeURIComponent(params.code)}`, {
				method: "POST",
				body,
				requestKey: null
			});
		} catch (sendError) {
			const message = (sendError as { response?: { message?: string } }).response?.message;
			return fail(400, { checkInError: message || "Couldn't check in. Try again." });
		}
		return { checkedIn: true };
	}
};
