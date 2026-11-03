import { error } from "@sveltejs/kit";
import { pageCards } from "$lib/server/cards/pages";
import { pngResponse, renderCard } from "$lib/server/cards/kit";
import type { EntryGenerator, RequestHandler } from "./$types";

// Link preview images for pages whose card never changes. They're drawn once
// at build time and served as static files.
export const prerender = true;

export const entries: EntryGenerator = () => Object.keys(pageCards).map((slug) => ({ slug }));

export const GET: RequestHandler = async ({ params }) => {
	const card = pageCards[params.slug];
	if (!card) error(404, "Not found.");
	return pngResponse(await renderCard(card()));
};
