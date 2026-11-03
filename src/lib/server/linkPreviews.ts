import { env } from "$env/dynamic/public";
import { eventIdFromPath, eventPreviewMeta, fetchEventPreview } from "./eventPreview";

// Link previews for pages that need a sign-in. Preview bots aren't signed in,
// so they land on /login?redirectTo=... and these describe where the link was
// really going.

export type LinkPreview = {
	title: string;
	description: string;
	image: string;
	imageAlt: string;
	url: string;
};

export type UpcomingEvent = { name: string; start: Date; end: Date; place: string };
export type MeetingPreview = { name: string; opensAt: Date; closesAt: Date };

const pbUrl = () => env.PUBLIC_POCKETBASE_URL || "https://db.stuyarista.org";
const toDate = (value: string) => new Date(value.replace(" ", "T"));

async function getJson(path: string, fetcher: typeof fetch) {
	try {
		const response = await fetcher(`${pbUrl()}${path}`, { signal: AbortSignal.timeout(4000) });
		return response.ok ? await response.json() : null;
	} catch {
		return null;
	}
}

/** The next three events that haven't ended. */
export async function fetchUpcoming(
	fetcher: typeof fetch = fetch
): Promise<UpcomingEvent[] | null> {
	const raw = await getJson("/api/arista/upcoming-preview", fetcher);
	if (!Array.isArray(raw)) return null;
	return raw.map((event) => ({
		name: event.name,
		start: toDate(event.start_time),
		end: toDate(event.end_time),
		place: event.place
	}));
}

/** A self check-in meeting's name and window, by its QR link code. */
export async function fetchMeeting(
	code: string,
	fetcher: typeof fetch = fetch
): Promise<MeetingPreview | null> {
	if (!/^[A-Za-z0-9_-]{4,32}$/.test(code)) return null;
	const raw = await getJson(`/api/arista/meeting-preview/${encodeURIComponent(code)}`, fetcher);
	if (!raw) return null;
	return { name: raw.name, opensAt: toDate(raw.opensAt), closesAt: toDate(raw.closesAt) };
}

const shortDay = new Intl.DateTimeFormat("en-US", {
	timeZone: "America/New_York",
	weekday: "short",
	month: "short",
	day: "numeric"
});
const longDay = new Intl.DateTimeFormat("en-US", {
	timeZone: "America/New_York",
	weekday: "long",
	month: "long",
	day: "numeric"
});

// A short hash, so an image URL changes when what it shows changes.
function version(parts: unknown[]) {
	const text = parts.join("|");
	let hash = 0;
	for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
	return (hash >>> 0).toString(36);
}

const staticCard = (
	origin: string,
	path: string,
	slug: string,
	title: string,
	description: string,
	imageAlt: string
): LinkPreview => ({
	title,
	description,
	image: `${origin}/og/page/${slug}.png`,
	imageAlt,
	url: `${origin}${path}`
});

/** The link preview for a signed-in page someone was redirected from, if it has one. */
export async function linkPreviewFor(
	redirectTo: string | null,
	origin: string,
	fetcher: typeof fetch = fetch
): Promise<LinkPreview | null> {
	if (!redirectTo || !redirectTo.startsWith("/")) return null;
	const path = redirectTo.split("?")[0].replace(/\/$/, "") || "/";

	const eventId = eventIdFromPath(path);
	if (eventId) {
		const preview = await fetchEventPreview(eventId, fetcher);
		return preview ? eventPreviewMeta(preview, origin) : null;
	}

	if (path === "/events" || path === "/events/directory") {
		const upcoming = (await fetchUpcoming(fetcher)) ?? [];
		const listed = upcoming
			.map((event) => `${event.name} (${shortDay.format(event.start)})`)
			.join(", ");
		return {
			title: "Upcoming events | Stuyvesant ARISTA",
			description: upcoming.length
				? `Coming up: ${listed}. ARISTA members sign in to sign up.`
				: "Volunteer events for ARISTA members. New events are posted here first.",
			image: `${origin}/og/events.png?v=${version(upcoming.map((event) => [event.name, event.start.getTime(), event.place]))}`,
			imageAlt: upcoming.length ? `Upcoming ARISTA events: ${listed}.` : "Upcoming ARISTA events.",
			url: `${origin}/events`
		};
	}

	const attendance = path.match(/^\/attendance\/([A-Za-z0-9_-]{4,32})$/);
	if (attendance) {
		const meeting = await fetchMeeting(attendance[1], fetcher);
		if (!meeting) return null;
		const day = longDay.format(meeting.opensAt);
		return {
			title: `Check in: ${meeting.name} | Stuyvesant ARISTA`,
			description: `Check in to ${meeting.name} on ${day}. Sign in, take a quick selfie, and you're marked present.`,
			image: `${origin}/og/meeting/${attendance[1]}.png?v=${version([meeting.name, meeting.opensAt.getTime()])}`,
			imageAlt: `Check in to ${meeting.name}, ${day}.`,
			url: `${origin}${path}`
		};
	}

	if (path.startsWith("/tutoring"))
		return staticCard(
			origin,
			"/tutoring",
			"tutoring",
			"Request a free peer tutor | Stuyvesant ARISTA",
			"Get help with a class or an upcoming test from an ARISTA member. Requests take a minute and tutoring is free.",
			"Get a free tutor from a classmate, with a chat between a student and an ARISTA tutor."
		);
	if (path.startsWith("/apply"))
		return staticCard(
			origin,
			"/apply",
			"apply",
			"Apply to ARISTA | Stuyvesant ARISTA",
			"Apply to Stuyvesant's honor society. Open to current freshmen, sophomores and juniors with a 92 or higher overall average.",
			"Apply to ARISTA, Stuyvesant High School Honor Society, on a certificate."
		);
	if (path.startsWith("/leaderboard"))
		return staticCard(
			origin,
			"/leaderboard",
			"leaderboard",
			"Leaderboard | Stuyvesant ARISTA",
			"The members who've tutored and volunteered the most this semester. For ARISTA members.",
			"The ARISTA leaderboard, shown as a podium."
		);
	if (path.startsWith("/settings"))
		return staticCard(
			origin,
			"/settings",
			"settings",
			"Settings | Stuyvesant ARISTA",
			"Your name, theme and email preferences on Stuyvesant ARISTA.",
			"ARISTA settings: preferred name, dark mode and message emails."
		);
	if (path.startsWith("/admin"))
		return staticCard(
			origin,
			"/admin",
			"admin",
			"Admin | Stuyvesant ARISTA",
			"People, credits, tutoring review and attendance, for ARISTA officers.",
			"The ARISTA admin sections as a grid of tiles."
		);
	return null;
}
