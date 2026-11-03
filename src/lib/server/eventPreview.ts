import { env } from "$env/dynamic/public";
import { calculateEventCredits } from "$lib/calculateCredits";
import type { RecievedEvent } from "$lib/db_types";

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

// PocketBase dates look like "2026-11-05 14:00:00.000Z".
const toDate = (value: string) => new Date(value.replace(" ", "T"));

/**
 * The public summary of an event, from the PocketBase preview route. Event
 * pages need a member sign-in, so this is what link previews show instead.
 */
export async function fetchEventPreview(
	id: string,
	fetcher: typeof fetch = fetch
): Promise<EventPreview | null> {
	try {
		const base = env.PUBLIC_POCKETBASE_URL || "https://db.stuyarista.org";
		const response = await fetcher(`${base}/api/arista/event-preview/${id}`, {
			signal: AbortSignal.timeout(4000)
		});
		if (!response.ok) return null;
		const raw = await response.json();
		const start = toDate(raw.start_time);
		const end = toDate(raw.end_time);
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
	} catch {
		return null;
	}
}

const inNewYork = (options: Intl.DateTimeFormatOptions) =>
	new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...options });
const dayFormat = inNewYork({ weekday: "long", month: "long", day: "numeric" });
const timeFormat = inNewYork({ hour: "numeric", minute: "2-digit" });

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

/** "9:00 AM to 12:00 PM", or with short, "9:00 to 11:30 AM" when both share AM or PM. */
export function formatPreviewTime(preview: EventPreview, short = false) {
	const start = timeFormat.format(preview.start);
	const end = timeFormat.format(preview.end);
	if (short && start.slice(-2) === end.slice(-2)) return `${start.slice(0, -3)} to ${end}`;
	return `${start} to ${end}`;
}

export function previewCredits(preview: EventPreview) {
	return `${preview.credits} event credit${preview.credits === 1 ? "" : "s"}`;
}

// Changes whenever what the image shows changes, so cached images refresh.
function imageVersion(preview: EventPreview) {
	const text = [
		preview.name,
		preview.start.getTime(),
		preview.end.getTime(),
		preview.location,
		preview.place,
		preview.credits
	].join("|");
	let hash = 0;
	for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
	return (hash >>> 0).toString(36);
}

/** Title, description and image for the page's link preview tags. */
export function eventPreviewMeta(preview: EventPreview, origin: string) {
	const where = preview.location ? ` at ${preview.location}` : "";
	return {
		title: `${preview.name} | ARISTA event`,
		description: `${formatPreviewDay(preview)}, ${formatPreviewTime(preview)}${where}. ${previewCredits(preview)}. ${preview.signedUp} of ${preview.intendedVolunteers} volunteers signed up. ARISTA members sign in to sign up.`,
		image: `${origin}/og/event/${preview.id}.png?v=${imageVersion(preview)}`,
		imageAlt: `${preview.name}: ${formatPreviewDay(preview)}, ${formatPreviewTime(preview)}.`,
		url: `${origin}/events/view/${preview.id}`
	};
}
