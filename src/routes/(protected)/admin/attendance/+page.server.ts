import { error, fail } from "@sveltejs/kit";
import { isAdmin } from "$lib/adminAccess";
import type { RecievedUser } from "$lib/db_types";
import { localToIso, openNowFilter, toMeeting } from "$lib/server/attendance";
import type { Actions, PageServerLoad } from "./$types";

export const load = (async ({ locals }) => {
	const admin = isAdmin(locals.user as RecievedUser);
	const openMeetings = (
		await locals.pb
			.collection("meetings")
			.getFullList({ filter: openNowFilter(), sort: "opensAt", requestKey: null })
	).map(toMeeting);
	if (!admin) return { admin, openMeetings, meetings: [] };

	const [meetings, checkIns] = await Promise.all([
		locals.pb.collection("meetings").getList(1, 50, { sort: "-opensAt", requestKey: null }),
		locals.pb.collection("attendance").getFullList({ fields: "meeting", requestKey: null })
	]);
	const counts = new Map<string, number>();
	for (const checkIn of checkIns)
		counts.set(checkIn.meeting, (counts.get(checkIn.meeting) ?? 0) + 1);
	return {
		admin,
		openMeetings,
		meetings: meetings.items.map((meeting) => ({
			...toMeeting(meeting),
			count: counts.get(meeting.id) ?? 0
		}))
	};
}) satisfies PageServerLoad;

function requireAdmin(locals: App.Locals) {
	if (!isAdmin(locals.user as RecievedUser)) error(403, "Only admins can manage meetings.");
}

export const actions: Actions = {
	create_meeting: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const name = String(form.get("name") ?? "")
			.trim()
			.slice(0, 120);
		const offset = Number(form.get("offset"));
		const opensAt = localToIso(String(form.get("opensAt") ?? ""), offset);
		const closesAt = localToIso(String(form.get("closesAt") ?? ""), offset);
		if (!name) return fail(400, { meetingError: "Give the meeting a name." });
		if (!opensAt || !closesAt)
			return fail(400, { meetingError: "Pick when check-in opens and closes." });
		if (closesAt <= opensAt)
			return fail(400, { meetingError: "Check-in has to close after it opens." });
		await locals.pb
			.collection("meetings")
			.create({ name, opensAt, closesAt, createdBy: locals.user?.id }, { requestKey: null });
		return { meetingCreated: true };
	},
	close_meeting: async ({ locals, request }) => {
		requireAdmin(locals);
		const id = String((await request.formData()).get("id") ?? "");
		await locals.pb
			.collection("meetings")
			.update(id, { closesAt: new Date().toISOString() }, { requestKey: null });
		return { meetingClosed: id };
	}
};
