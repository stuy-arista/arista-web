import { fail } from "@sveltejs/kit";
import { isAdmin } from "$lib/adminAccess";
import type { RecievedUser } from "$lib/db_types";
import { openNowFilter, toMeeting } from "$lib/server/attendance";
import type { Actions, PageServerLoad } from "./$types";

export const load = (async ({ locals, url }) => {
	const admin = isAdmin(locals.user as RecievedUser);
	// Admins can run check-in for one particular meeting from its page: a QR
	// meeting (someone forgot their phone), or outside its window (someone
	// leaving early or arriving late).
	const chosen = url.searchParams.get("meeting");
	if (admin && chosen) {
		try {
			const meeting = toMeeting(
				await locals.pb.collection("meetings").getOne(chosen, { requestKey: null })
			);
			const now = Date.now();
			const outsideWindow = now < Date.parse(meeting.opensAt) || now > Date.parse(meeting.closesAt);
			return { openMeetings: [meeting], outsideWindow, chosen: true };
		} catch {
			// Fall through to the usual list.
		}
	}
	return {
		openMeetings: (
			await locals.pb.collection("meetings").getFullList({
				// Device accounts only see device meetings; admins see QR ones too.
				filter: admin ? openNowFilter() : `${openNowFilter()} && mode != "self"`,
				sort: "opensAt",
				requestKey: null
			})
		).map(toMeeting),
		outsideWindow: false,
		chosen: false
	};
}) satisfies PageServerLoad;

export const actions: Actions = {
	check_in: async ({ locals, request }) => {
		const form = await request.formData();
		const meeting = String(form.get("meeting") ?? "");
		const user = String(form.get("user") ?? "");
		const photo = form.get("photo");
		if (!meeting || !user) return fail(400, { checkInError: "Pick a meeting and a member." });
		if (!(photo instanceof File) || photo.size === 0)
			return fail(400, { checkInError: "Take a photo first." });

		const data = new FormData();
		data.set("meeting", meeting);
		data.set("user", user);
		data.set("takenBy", locals.user?.id ?? "");
		data.set("photo", photo, "check-in.jpg");
		try {
			await locals.pb.collection("attendance").create(data, { requestKey: null });
		} catch (createError) {
			const details = (createError as { response?: { data?: Record<string, { code?: string }> } })
				.response?.data;
			if (
				details?.meeting?.code === "validation_not_unique" ||
				details?.user?.code === "validation_not_unique"
			)
				return fail(400, { checkInError: "You're already checked in to this meeting." });
			console.error("Check-in failed", createError);
			return fail(400, {
				checkInError: "Couldn't check in. The meeting may have closed. Ask an officer."
			});
		}
		return { checkedIn: true };
	}
};
