import QRCode from "qrcode";
import seal from "$lib/assets/qr-seal.jpg?inline";

const NAVY = "#22397d";
const FLAME = "#f2a93b";

/**
 * An ARISTA-styled QR code as SVG: navy modules and the seal in the middle,
 * ringed in flame. Modules and corner markers stay square: rounded dots and
 * corners failed a strict decoder (jsQR) at large sizes, and flame reads as
 * light to scanners, so it's only used away from the code itself. It uses the highest error
 * correction (about 30% of the code can be covered) so the seal doesn't stop
 * it from scanning, and keeps the standard quiet zone around it.
 */
export async function brandedQr(text: string) {
	const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
	const size = qr.modules.size;
	const dark = (row: number, col: number) => qr.modules.get(row, col) === 1;
	const quiet = 4;
	const total = size + quiet * 2;

	// The three corner markers are drawn separately, so skip their cells.
	const inFinder = (row: number, col: number) =>
		(row < 7 && col < 7) || (row < 7 && col >= size - 7) || (row >= size - 7 && col < 7);

	// Leave a clear circle in the middle for the seal (about 22% of the width).
	const logoSize = Math.round(size * 0.22) | 1;
	const center = size / 2;
	const clearRadius = logoSize / 2 + 1;
	const underLogo = (row: number, col: number) =>
		Math.hypot(row + 0.5 - center, col + 0.5 - center) < clearRadius;

	const dots: string[] = [];
	for (let row = 0; row < size; row++) {
		for (let col = 0; col < size; col++) {
			if (!dark(row, col) || inFinder(row, col) || underLogo(row, col)) continue;
			dots.push(`M${col + quiet} ${row + quiet}h1v1h-1z`);
		}
	}

	const finder = (row: number, col: number) => {
		const x = col + quiet;
		const y = row + quiet;
		return (
			`<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" fill="none" stroke="${NAVY}" stroke-width="1"/>` +
			`<rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="${NAVY}"/>`
		);
	};

	const logoX = quiet + center - logoSize / 2;
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" role="img" aria-label="QR code">` +
		`<rect width="${total}" height="${total}" rx="2" fill="#fff"/>` +
		`<path fill="${NAVY}" shape-rendering="crispEdges" d="${dots.join("")}"/>` +
		finder(0, 0) +
		finder(0, size - 7) +
		finder(size - 7, 0) +
		`<defs><clipPath id="qr-seal"><circle cx="${quiet + center}" cy="${quiet + center}" r="${logoSize / 2}"/></clipPath></defs>` +
		`<circle cx="${quiet + center}" cy="${quiet + center}" r="${clearRadius - 0.3}" fill="#fff"/>` +
		`<circle cx="${quiet + center}" cy="${quiet + center}" r="${logoSize / 2 + 0.35}" fill="none" stroke="${FLAME}" stroke-width="0.5"/>` +
		`<image href="${seal}" x="${logoX}" y="${logoX}" width="${logoSize}" height="${logoSize}" clip-path="url(#qr-seal)"/>` +
		`</svg>`;
	return svg;
}
