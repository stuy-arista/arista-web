import { error, fail } from "@sveltejs/kit";
import { isAdmin } from "$lib/adminAccess";
import type { RecievedUser } from "$lib/db_types";
import { localToIso, toMeeting } from "$lib/server/attendance";
import { brandedQr } from "$lib/server/brandedQr";
import type { Actions, PageServerLoad } from "./$types";

export const load = (async ({ locals, params, url }) => {
	if (!isAdmin(locals.user as RecievedUser)) error(403, "Only admins can see who checked in.");
	let meeting;
	try {
		meeting = toMeeting(
			await locals.pb.collection("meetings").getOne(params.id, { requestKey: null })
		);
	} catch {
		error(404, "Meeting not found.");
	}
	const [checkIns, members] = await Promise.all([
		locals.pb.collection("attendance").getFullList({
			filter: `meeting="${meeting.id}"`,
			sort: "created",
			requestKey: null
		}),
		locals.pb.collection("users").getFullList({
			filter: "member=true",
			fields: "id,name,graduationYear",
			sort: "name",
			requestKey: null
		})
	]);
	const nameOf = new Map(members.map((member) => [member.id, member.name as string]));
	const present = new Set(checkIns.map((checkIn) => checkIn.user as string));
	const takerIds = [
		...new Set(checkIns.map((checkIn) => checkIn.takenBy as string).filter(Boolean))
	];
	const takers = takerIds.length
		? await locals.pb.collection("publicUsers").getFullList({
				filter: takerIds.map((id) => `id="${id}"`).join(" || "),
				fields: "id,name",
				requestKey: null
			})
		: [];
	const link = meeting.mode === "self" ? `${url.origin}/attendance/${meeting.code}` : "";
	const qr = link ? await brandedQr(link) : "";
	return {
		meeting,
		link,
		qr,
		checkIns: checkIns.map((checkIn) => ({
			id: checkIn.id,
			userId: checkIn.user as string,
			name: nameOf.get(checkIn.user) ?? "Former member",
			time: checkIn.created as string,
			hasPhoto: Boolean(checkIn.photo),
			takenBy: takers.find((taker) => taker.id === checkIn.takenBy)?.name ?? ""
		})),
		absent: members
			.filter((member) => !present.has(member.id))
			.map((member) => ({
				id: member.id,
				name: member.name as string,
				graduationYear: member.graduationYear as number
			}))
	};
}) satisfies PageServerLoad;

export const actions: Actions = {
	update_meeting: async ({ locals, params, request }) => {
		if (!isAdmin(locals.user as RecievedUser)) error(403, "Only admins can edit meetings.");
		const form = await request.formData();
		const name = String(form.get("name") ?? "")
			.trim()
			.slice(0, 120);
		const offset = Number(form.get("offset"));
		const opensAt = localToIso(String(form.get("opensAt") ?? ""), offset);
		const closesAt = localToIso(String(form.get("closesAt") ?? ""), offset);
		const instructions = String(form.get("instructions") ?? "")
			.trim()
			.slice(0, 300);
		if (!name) return fail(400, { editError: "Give the meeting a name." });
		if (!opensAt || !closesAt)
			return fail(400, { editError: "Pick when check-in opens and closes." });
		if (closesAt <= opensAt)
			return fail(400, { editError: "Check-in has to close after it opens." });
		try {
			await locals.pb
				.collection("meetings")
				.update(params.id, { name, opensAt, closesAt, instructions }, { requestKey: null });
		} catch {
			return fail(400, { editError: "Couldn't save the meeting. Try again." });
		}
		return { meetingUpdated: true };
	},
	remove_check_in: async ({ locals, request }) => {
		if (!isAdmin(locals.user as RecievedUser)) error(403, "Only admins can remove check-ins.");
		const id = String((await request.formData()).get("id") ?? "");
		try {
			await locals.pb.collection("attendance").delete(id, { requestKey: null });
		} catch {
			return fail(400, { removeError: "Couldn't remove that check-in." });
		}
		return { removed: id };
	}
};
