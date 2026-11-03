import type { MeetingPreview, UpcomingEvent } from "../linkPreviews";
import {
	clamp,
	CREAM,
	FLAME,
	FLAME_LIGHT,
	FLAME_TEXT,
	h,
	HEIGHT,
	masthead,
	MIST,
	NAVY,
	NAVY_GLOW,
	NIGHT,
	text,
	WIDTH
} from "./kit";

// Cards drawn from live data: the next few events, and a meeting's check-in.

const inNewYork = (options: Intl.DateTimeFormatOptions) =>
	new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...options });
const monthFormat = inNewYork({ month: "short" });
const dayFormat = inNewYork({ day: "numeric" });
const weekdayFormat = inNewYork({ weekday: "long" });
const longDayFormat = inNewYork({ weekday: "long", month: "long", day: "numeric" });
const timeFormat = inNewYork({ hour: "numeric", minute: "2-digit" });

const CHECK = `data:image/svg+xml;base64,${Buffer.from(
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="${NAVY}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/></svg>`
).toString("base64")}`;

// The events calendar: an agenda of what's next, each with a small date stub.
export function upcomingCard(events: UpcomingEvent[]) {
	const row = (event: UpcomingEvent, last: boolean) =>
		h(
			"div",
			{
				alignItems: "center",
				gap: 28,
				padding: "16px 0",
				borderBottom: last ? "none" : "2px dashed rgba(201,211,238,0.25)"
			},
			[
				h(
					"div",
					{
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						width: 104,
						height: 104,
						flexShrink: 0,
						borderRadius: 16,
						backgroundColor: CREAM
					},
					[
						text(monthFormat.format(event.start), { size: 22, weight: 700, color: FLAME_TEXT }),
						text(dayFormat.format(event.start), {
							size: 52,
							serif: true,
							lineHeight: 1,
							color: NAVY
						})
					]
				),
				h("div", { flexDirection: "column", gap: 6, minWidth: 0, flexShrink: 1 }, [
					clamp(event.name, 1, { size: 40, serif: true, color: "#fff", lineHeight: 1.15 }),
					text(
						[
							weekdayFormat.format(event.start),
							timeFormat.format(event.start),
							event.place && event.place !== "Other" ? event.place : ""
						]
							.filter(Boolean)
							.join(", "),
						{ size: 25, color: MIST }
					)
				])
			]
		);
	const shown = events.slice(0, 3);
	return h(
		"div",
		{
			flexDirection: "column",
			width: WIDTH,
			height: HEIGHT,
			padding: "50px 70px",
			backgroundColor: NAVY,
			backgroundImage: NAVY_GLOW
		},
		[
			h("div", { alignItems: "center", justifyContent: "space-between" }, [
				masthead("Stuyvesant ARISTA events"),
				text("Coming up", { size: 60, serif: true, color: "#fff", lineHeight: 1 })
			]),
			shown.length
				? h(
						"div",
						{ flexDirection: "column", flexGrow: 1, justifyContent: "center", marginTop: 14 },
						shown.map((event, index) => row(event, index === shown.length - 1))
					)
				: h("div", { flexDirection: "column", flexGrow: 1, justifyContent: "center", gap: 18 }, [
						text("New events are on the way", { size: 76, serif: true, color: "#fff" }),
						text("Check back soon. ARISTA members sign up on the events calendar.", {
							size: 30,
							color: MIST
						})
					])
		]
	);
}

// A meeting's check-in: the name and day, the three steps, and a big check.
export function meetingCard(meeting: MeetingPreview) {
	const step = (number: number, label: string) =>
		h("div", { alignItems: "center", gap: 14 }, [
			h(
				"div",
				{
					width: 44,
					height: 44,
					borderRadius: 22,
					alignItems: "center",
					justifyContent: "center",
					border: `2px solid ${FLAME_LIGHT}`
				},
				[text(String(number), { size: 22, weight: 700, color: FLAME_LIGHT })]
			),
			text(label, { size: 27, weight: 700, color: "#fff" })
		]);
	const opens = timeFormat.format(meeting.opensAt);
	const closes = timeFormat.format(meeting.closesAt);
	// "4:00 to 4:30 PM" when both share AM or PM.
	const window =
		opens.slice(-2) === closes.slice(-2)
			? `${opens.slice(0, -3)} to ${closes}`
			: `${opens} to ${closes}`;
	return h(
		"div",
		{
			width: WIDTH,
			height: HEIGHT,
			padding: "56px 70px",
			backgroundColor: NIGHT,
			justifyContent: "space-between",
			alignItems: "center",
			position: "relative",
			overflow: "hidden"
		},
		[
			h("div", {
				position: "absolute",
				right: -160,
				top: -40,
				width: 720,
				height: 720,
				borderRadius: 360,
				backgroundImage: "radial-gradient(circle, rgba(242,169,59,0.22) 0%, rgba(242,169,59,0) 65%)"
			}),
			h(
				"div",
				{ flexDirection: "column", justifyContent: "space-between", height: "100%", width: 700 },
				[
					masthead("Meeting check-in"),
					h("div", { flexDirection: "column", gap: 16 }, [
						clamp(meeting.name, 2, { size: 80, serif: true, color: "#fff", lineHeight: 1.04 }),
						text(`${longDayFormat.format(meeting.opensAt)}, ${window}`, { size: 29, color: MIST })
					]),
					h("div", { gap: 30 }, [
						step(1, "Sign in"),
						step(2, "Take a selfie"),
						step(3, "You're in")
					])
				]
			),
			h(
				"div",
				{
					width: 260,
					height: 260,
					borderRadius: 130,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: FLAME,
					border: `12px solid ${FLAME_LIGHT}`,
					boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
					marginRight: 20
				},
				[h("img", {}, undefined, { src: CHECK, width: 150, height: 150 })]
			)
		]
	);
}
