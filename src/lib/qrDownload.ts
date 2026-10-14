/** Save an SVG QR code as a 1200px PNG (works in Google Slides, Docs, printers). */
export async function downloadQrPng(svg: string, filename: string) {
	const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
	try {
		const image = new Image();
		image.src = url;
		await image.decode();
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = 1200;
		canvas.getContext("2d")?.drawImage(image, 0, 0, 1200, 1200);
		const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
		if (!png) return;
		const link = document.createElement("a");
		link.href = URL.createObjectURL(png);
		link.download = filename;
		link.click();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000);
	} finally {
		URL.revokeObjectURL(url);
	}
}

export function qrFilename(meetingName: string) {
	const slug = meetingName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
	return `arista-check-in-${slug || "meeting"}.png`;
}
