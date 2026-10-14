import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

// Tiny change check for LiveUpdates.svelte (see local_pb/pb_hooks/live.pb.js).
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return json({});
	try {
		return json(
			await locals.pb.send("/api/arista/live", {
				query: { c: url.searchParams.get("c") ?? "" },
				requestKey: null
			}),
			{ headers: { "Cache-Control": "no-store" } }
		);
	} catch {
		return json({});
	}
};
