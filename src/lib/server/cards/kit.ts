import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sealImage from "$lib/assets/qr-seal.jpg?inline";
import fraunces from "@fontsource/fraunces/files/fraunces-latin-600-normal.woff?inline";
import figtree from "@fontsource/figtree/files/figtree-latin-500-normal.woff?inline";
import figtreeBold from "@fontsource/figtree/files/figtree-latin-700-normal.woff?inline";

// Shared pieces for the 1200×630 link preview cards: the site's fonts and
// colors, a tiny element builder for satori, and PNG rendering.

export const WIDTH = 1200;
export const HEIGHT = 630;

export const NAVY = "#16275a";
export const SEAL = "#22397d";
export const NIGHT = "#0d1838";
export const FLAME = "#f2a93b";
export const FLAME_LIGHT = "#f8c978";
export const FLAME_TEXT = "#8a5300";
export const CREAM = "#fdf3df";
export const PAPER = "#fcfbf8";
export const MIST = "#c9d3ee";
export const SLATE = "#3d4a72";

export const NAVY_GLOW =
	"radial-gradient(ellipse 90% 100% at 20% 20%, #2a4590 0%, #1d3272 50%, #16275a 100%)";

const fromDataUrl = (url: string) => Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
const fonts = [
	{ name: "Fraunces", data: fromDataUrl(fraunces), weight: 600 as const, style: "normal" as const },
	{ name: "Figtree", data: fromDataUrl(figtree), weight: 500 as const, style: "normal" as const },
	{
		name: "Figtree",
		data: fromDataUrl(figtreeBold),
		weight: 700 as const,
		style: "normal" as const
	}
];

export type Node = { type: string; props: Record<string, unknown> };
export type Style = Record<string, unknown>;

/** An element for satori. Every element with children is a flex box unless it says otherwise. */
export const h = (type: string, style: Style, children?: unknown, extra = {}): Node => ({
	type,
	props: { style: { display: "flex", ...style }, children, ...extra }
});

/** Plain text in one of the two families. */
export function text(
	value: string,
	style: Style & { size: number; weight?: 500 | 600 | 700; serif?: boolean }
) {
	const { size, weight, serif, ...rest } = style;
	return h(
		"div",
		{
			fontFamily: serif ? "Fraunces" : "Figtree",
			fontWeight: weight ?? (serif ? 600 : 500),
			fontSize: size,
			...(serif ? { letterSpacing: -1 } : {}),
			...rest
		},
		value
	);
}

/** Text that wraps and stops after a number of lines with an ellipsis. */
export const clamp = (value: string, lines: number, style: Parameters<typeof text>[1]) =>
	text(value, { ...style, display: "block", lineClamp: lines });

/** The ARISTA seal in a gold ring. */
export function seal(size: number, ring = 3) {
	return h(
		"img",
		{ width: size, height: size, borderRadius: size / 2, border: `${ring}px solid ${FLAME}` },
		undefined,
		{ src: sealImage, width: size, height: size }
	);
}

/** The seal beside a short gold label, used at the top of most cards. */
export function masthead(label: string, color = FLAME_LIGHT) {
	return h("div", { alignItems: "center", gap: 18 }, [
		seal(58),
		text(label, { size: 26, weight: 700, color })
	]);
}

/** Render a card to PNG bytes. */
export async function renderCard(tree: Node) {
	const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
		width: WIDTH,
		height: HEIGHT,
		fonts
	});
	return new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng();
}

/** A PNG response that browsers and Vercel's CDN can keep. */
export function pngResponse(png: Uint8Array, cacheSeconds = 86400) {
	return new Response(new Uint8Array(png), {
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": `public, max-age=${Math.min(cacheSeconds, 3600)}, s-maxage=${cacheSeconds}, stale-while-revalidate=604800`
		}
	});
}
