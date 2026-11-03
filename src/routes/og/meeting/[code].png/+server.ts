import { error } from "@sveltejs/kit";
import { fetchMeeting } from "$lib/server/linkPreviews";
import { meetingCard } from "$lib/server/cards/live";
import { pngResponse, renderCard } from "$lib/server/cards/kit";
import type { RequestHandler } from "./$types";

// The link preview image for a meeting's QR check-in link.
export const GET: RequestHandler = async ({ params, fetch }) => {
	const meeting = await fetchMeeting(params.code, fetch);
	if (!meeting) error(404, "Not found.");
	return pngResponse(await renderCard(meetingCard(meeting)));
};
