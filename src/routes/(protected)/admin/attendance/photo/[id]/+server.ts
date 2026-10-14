import { error } from "@sveltejs/kit";
import { isAdmin } from "$lib/adminAccess";
import type { RecievedUser } from "$lib/db_types";
import type { RequestHandler } from "./$types";

// Check-in selfies are admins-only; PocketBase also refuses anyone else.
export const GET: RequestHandler = async ({ locals, params, fetch }) => {
	if (!isAdmin(locals.user as RecievedUser)) error(403, "Only admins can see check-in photos.");
	let record;
	try {
		record = await locals.pb.collection("attendance").getOne(params.id, { requestKey: null });
	} catch {
		error(404, "Check-in not found.");
	}
	if (!record.photo) error(404, "This photo was removed after 30 days.");
	const token = await locals.pb.files.getToken({ requestKey: null });
	const source = new URL(locals.pb.files.getURL(record, record.photo));
	source.searchParams.set("token", token);
	const photo = await fetch(source);
	if (!photo.ok || !photo.body) error(502, "The photo could not be loaded.");
	return new Response(photo.body, {
		headers: {
			"Content-Type": photo.headers.get("Content-Type") ?? "image/jpeg",
			"Cache-Control": "private, max-age=300"
		}
	});
};
