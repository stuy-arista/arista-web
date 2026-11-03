import { env } from "$env/dynamic/public";

// Helpers shared by the link preview text and images.

/** A date formatter in New York time, whatever time zone the server runs in. */
export const inNewYork = (options: Intl.DateTimeFormatOptions) =>
	new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...options });

const timeFormat = inNewYork({ hour: "numeric", minute: "2-digit" });

/** "9:00 AM to 12:00 PM", or with short, "9:00 to 11:30 AM" when both share AM or PM. */
export function timeRange(start: Date, end: Date, short = false) {
	const from = timeFormat.format(start);
	const to = timeFormat.format(end);
	if (short && from.slice(-2) === to.slice(-2)) return `${from.slice(0, -3)} to ${to}`;
	return `${from} to ${to}`;
}

/** PocketBase dates look like "2026-11-05 14:00:00.000Z". */
export const pbDate = (value: string) => new Date(value.replace(" ", "T"));

/** A short hash for an image URL, so it changes when what the image shows changes. */
export function previewVersion(parts: unknown[]) {
	const text = parts.join("|");
	let hash = 0;
	for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
	return (hash >>> 0).toString(36);
}

/** GET one of PocketBase's public preview routes, or null if it fails or is slow. */
export async function getPreviewJson(path: string, fetcher: typeof fetch = fetch) {
	try {
		const base = env.PUBLIC_POCKETBASE_URL || "https://db.stuyarista.org";
		const response = await fetcher(`${base}${path}`, { signal: AbortSignal.timeout(4000) });
		return response.ok ? await response.json() : null;
	} catch {
		return null;
	}
}
