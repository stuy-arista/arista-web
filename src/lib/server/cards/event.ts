import {
	formatPreviewTime,
	previewCredits,
	previewDateParts,
	type EventPreview
} from "../eventPreview";
import {
	clamp,
	CREAM,
	FLAME,
	FLAME_LIGHT,
	FLAME_TEXT,
	h,
	HEIGHT,
	masthead,
	NAVY,
	NAVY_GLOW,
	NIGHT,
	SLATE,
	text,
	WIDTH
} from "./kit";

// One event as a ticket: the name and details on the navy body, the date on a
// cream stub, with a punched tear line between them.

const INSET = 30;
const STUB_WIDTH = 318;
const TEAR_X = WIDTH - INSET - STUB_WIDTH;
const NOTCH = 24;

// Long names step down in size so they fit in three lines.
function titleSize(name: string) {
	if (name.length <= 18) return 84;
	if (name.length <= 36) return 68;
	if (name.length <= 60) return 56;
	return 46;
}

/** A gold outlined tag, like the borough under an event name. */
export function tag(label: string, color = FLAME_LIGHT) {
	return text(label, {
		size: 21,
		weight: 700,
		color,
		alignSelf: "flex-start",
		padding: "5px 16px",
		borderRadius: 999,
		border: `2px solid ${color === FLAME_LIGHT ? "rgba(248,201,120,0.6)" : color}`
	});
}

// A labelled fact at the bottom of the ticket. The value wraps to two lines.
function fact(label: string, value: string, width?: number) {
	return h(
		"div",
		{
			flexDirection: "column",
			gap: 6,
			minWidth: 0,
			...(width ? { width, flexShrink: 0 } : { flexGrow: 1, flexShrink: 1 })
		},
		[
			text(label, { size: 21, weight: 700, color: FLAME_LIGHT }),
			clamp(value, 2, { size: 27, lineHeight: 1.25, color: "#fff" })
		]
	);
}

function body(preview: EventPreview) {
	const name = preview.name.trim();
	const where = preview.location || preview.place || "To be announced";
	return h(
		"div",
		{
			flexDirection: "column",
			width: TEAR_X - INSET,
			height: "100%",
			padding: "50px 56px 46px",
			backgroundColor: NAVY,
			backgroundImage: NAVY_GLOW,
			color: "#fff"
		},
		[
			masthead("Stuyvesant ARISTA event"),
			h("div", { flexDirection: "column", justifyContent: "center", flexGrow: 1, gap: 18 }, [
				clamp(name, 3, { size: titleSize(name), serif: true, lineHeight: 1.04 }),
				// "Other" says nothing, so only real places get a tag.
				...(preview.place && preview.place !== "Other" ? [tag(preview.place)] : [])
			]),
			h("div", { gap: 40, paddingTop: 24, borderTop: "2px solid rgba(201,211,238,0.22)" }, [
				fact("Where", where),
				fact("Credit", previewCredits(preview), 200)
			])
		]
	);
}

function timeLines(time: string) {
	if (time.length <= 16) return [time];
	const [start, end] = time.split(" to ");
	return [start, `to ${end}`];
}

function stub(preview: EventPreview) {
	const { weekday, month, day } = previewDateParts(preview);
	return h(
		"div",
		{
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "center",
			width: STUB_WIDTH,
			height: "100%",
			padding: "0 30px",
			backgroundColor: CREAM,
			color: NAVY
		},
		[
			text(month, { size: 32, weight: 700, color: FLAME_TEXT }),
			text(day, { size: 168, serif: true, lineHeight: 1, letterSpacing: -4, margin: "4px 0 2px" }),
			text(weekday, { size: 28, color: SLATE }),
			h("div", { width: 64, height: 3, backgroundColor: FLAME, margin: "26px 0" }),
			// A long time breaks before "to" instead of wherever it runs out of room.
			...timeLines(formatPreviewTime(preview, true)).map((line) =>
				text(line, { size: 28, weight: 700, lineHeight: 1.25 })
			)
		]
	);
}

// Two half-circle notches cut into the edges and a row of punched holes.
function tear() {
	const holes = [];
	for (let y = INSET + NOTCH + 18; y <= HEIGHT - INSET - NOTCH - 18; y += 22) {
		holes.push(
			h("div", {
				position: "absolute",
				left: TEAR_X - 4,
				top: y - 4,
				width: 8,
				height: 8,
				borderRadius: 4,
				backgroundColor: NIGHT
			})
		);
	}
	const notch = (top: number) =>
		h("div", {
			position: "absolute",
			left: TEAR_X - NOTCH,
			top: top - NOTCH,
			width: NOTCH * 2,
			height: NOTCH * 2,
			borderRadius: NOTCH,
			backgroundColor: NIGHT
		});
	return [notch(INSET), notch(HEIGHT - INSET), ...holes];
}

export function eventCard(preview: EventPreview) {
	return h(
		"div",
		{ width: WIDTH, height: HEIGHT, padding: INSET, backgroundColor: NIGHT, position: "relative" },
		[
			h("div", { width: "100%", height: "100%", borderRadius: 26, overflow: "hidden" }, [
				body(preview),
				stub(preview)
			]),
			...tear()
		]
	);
}
