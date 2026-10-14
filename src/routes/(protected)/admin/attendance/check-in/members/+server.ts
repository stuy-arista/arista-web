import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

// Member search for the check-in screen. PocketBase's attendance route returns
// only id, name and class year, and only to attendance devices and admins.
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) error(401, "Sign in first.");
	const q = url.searchParams.get("q")?.trim() ?? "";
	if (q.length < 2) return json([]);
	try {
		return json(
			await locals.pb.send("/api/arista/attendance/members", { query: { q }, requestKey: null })
		);
	} catch (lookupError) {
		const status = (lookupError as { status?: number }).status ?? 502;
		error(status === 403 ? 403 : 502, "Couldn't search members.");
	}
};
