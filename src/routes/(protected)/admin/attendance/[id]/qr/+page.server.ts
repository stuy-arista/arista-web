import { error } from "@sveltejs/kit";
import { brandedQr } from "$lib/server/brandedQr";
import { isAdmin } from "$lib/adminAccess";
import type { RecievedUser } from "$lib/db_types";
import { toMeeting } from "$lib/server/attendance";
import type { PageServerLoad } from "./$types";

// Big QR code to put on a projector or screen at the meeting.
export const load = (async ({ locals, params, url }) => {
	if (!isAdmin(locals.user as RecievedUser)) error(403, "Only admins can show the check-in code.");
	let meeting;
	try {
		meeting = toMeeting(
			await locals.pb.collection("meetings").getOne(params.id, { requestKey: null })
		);
	} catch {
		error(404, "Meeting not found.");
	}
	if (meeting.mode !== "self") error(404, "This meeting uses check-in devices, not a QR code.");
	const link = `${url.origin}/attendance/${meeting.code}`;
	return {
		name: meeting.name,
		link,
		qr: await brandedQr(link)
	};
}) satisfies PageServerLoad;
