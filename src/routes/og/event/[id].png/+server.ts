import { error } from "@sveltejs/kit";
import { fetchEventPreview } from "$lib/server/eventPreview";
import { eventCard } from "$lib/server/cards/event";
import { pngResponse, renderCard } from "$lib/server/cards/kit";
import type { RequestHandler } from "./$types";

// The link preview image for an event page. Public, like the preview text.
// The image URL changes with the event's details, so caches can keep it.
export const GET: RequestHandler = async ({ params, fetch }) => {
	if (!/^[a-z0-9]{15}$/.test(params.id)) error(404, "Not found.");
	const preview = await fetchEventPreview(params.id, fetch);
	if (!preview) error(404, "Not found.");
	return pngResponse(await renderCard(eventCard(preview)));
};
