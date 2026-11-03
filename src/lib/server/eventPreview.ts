import { calculateEventCredits } from "$lib/calculateCredits";
import type { RecievedEvent } from "$lib/db_types";
import { getPreviewJson, inNewYork, pbDate, previewVersion, timeRange } from "./previewUtils";

export type EventPreview = {
	id: string;
	name: string;
	start: Date;
	end: Date;
	location: string;
	place: string;
	credits: number;
	intendedVolunteers: number;
	signedUp: number;
	closed: boolean;
	isComplete: boolean;
};

const EVENT_PATH = /^\/events\/view\/([a-z0-9]{15})\/?$/;

/** The event id in an event page path, or null. */
export function eventIdFromPath(path: string | null) {
	return path?.split("?")[0].match(EVENT_PATH)?.[1] ?? null;
}

/**
 * The public summary of an event, from the PocketBase preview route. Event
 * pages need a member sign-in, so this is what link previews show instead.
 */
export async function fetchEventPreview(
	id: string,
	fetcher: typeof fetch = fetch
): Promise<EventPreview | null> {
	const raw = await getPreviewJson(`/api/arista/event-preview/${id}`, fetcher);
	if (!raw) return null;
	const start = pbDate(raw.start_time);
	const end = pbDate(raw.end_time);
	return {
		id: raw.id,
		name: raw.name,
		start,
		end,
		location: raw.location,
		place: raw.place,
		credits: calculateEventCredits({
			start_time: start,
			end_time: end,
			multiplier: raw.multiplier
		} as RecievedEvent),
		intendedVolunteers: raw.intendedVolunteers,
		signedUp: raw.signedUp,
		closed: raw.signupStatus,
		isComplete: raw.isComplete
	};
}

const dayFormat = inNewYork({ weekday: "long", month: "long", day: "numeric" });

/** { weekday: "Wednesday", month: "July", day: "29" } in New York time. */
export function previewDateParts(preview: EventPreview) {
	const parts = Object.fromEntries(
		dayFormat.formatToParts(preview.start).map((part) => [part.type, part.value])
	);
	return { weekday: parts.weekday, month: parts.month, day: parts.day };
}

export function formatPreviewDay(preview: EventPreview) {
	return dayFormat.format(preview.start);
}

/** The event's time range; see timeRange. */
export function formatPreviewTime(preview: EventPreview, short = false) {
	return timeRange(preview.start, preview.end, short);
}

export function previewCredits(preview: EventPreview) {
	return `${preview.credits} event credit${preview.credits === 1 ? "" : "s"}`;
}

/** Title, description and image for the page's link preview tags. */
export function eventPreviewMeta(preview: EventPreview, origin: string) {
	const where = preview.location ? ` at ${preview.location}` : "";
	// Everything the image shows, so a changed event gets a fresh image.
	const version = previewVersion([
		preview.name,
		preview.start.getTime(),
		preview.end.getTime(),
		preview.location,
		preview.place,
		preview.credits
	]);
	return {
		title: `${preview.name} | ARISTA event`,
		description: `${formatPreviewDay(preview)}, ${formatPreviewTime(preview)}${where}. ${previewCredits(preview)}. ${preview.signedUp} of ${preview.intendedVolunteers} volunteers signed up. ARISTA members sign in to sign up.`,
		image: `${origin}/og/event/${preview.id}.png?v=${version}`,
		imageAlt: `${preview.name}: ${formatPreviewDay(preview)}, ${formatPreviewTime(preview)}.`,
		url: `${origin}/events/view/${preview.id}`
	};
}
