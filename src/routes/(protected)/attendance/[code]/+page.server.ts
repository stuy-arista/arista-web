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
	} catch (lookupError) {
		if ((lookupError as { status?: number }).status === 404) {
			error(404, "This check-in link isn't valid. Ask an officer for the right QR code.");
		}
		error(503, "Check-in is busy right now. Wait a few seconds and reload this page.");
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
			const { status, response } = sendError as {
				status?: number;
				response?: { message?: string };
			};
			// Messages from our own checks (already checked in, closed, members only).
			if (status && status >= 400 && status < 500 && response?.message) {
				return fail(400, { checkInError: response.message });
			}
			return fail(503, {
				checkInError: "Check-in is busy right now. Wait a few seconds and tap Check in again."
			});
		}
		return { checkedIn: true };
	}
};
