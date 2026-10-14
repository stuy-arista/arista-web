import { fail } from "@sveltejs/kit";
import { openNowFilter, toMeeting } from "$lib/server/attendance";
import type { Actions, PageServerLoad } from "./$types";

export const load = (async ({ locals }) => ({
	openMeetings: (
		await locals.pb
			.collection("meetings")
			.getFullList({ filter: openNowFilter(), sort: "opensAt", requestKey: null })
	).map(toMeeting)
})) satisfies PageServerLoad;

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
