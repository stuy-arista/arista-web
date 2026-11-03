import { fetchUpcoming } from "$lib/server/linkPreviews";
import { upcomingCard } from "$lib/server/cards/live";
import { pngResponse, renderCard } from "$lib/server/cards/kit";
import type { RequestHandler } from "./$types";

// The events calendar's link preview: the next three events. The page links
// it with a version of the list, so a new event means a new image URL.
export const GET: RequestHandler = async ({ fetch }) => {
	const upcoming = (await fetchUpcoming(fetch)) ?? [];
	return pngResponse(await renderCard(upcomingCard(upcoming)), 3600);
};
