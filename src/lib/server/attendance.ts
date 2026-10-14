import type { RecordModel } from "pocketbase";

export type Meeting = {
	id: string;
	name: string;
	opensAt: string;
	closesAt: string;
	/** "device": check-in on approved accounts' devices. "self": members' own phones via QR link. */
	mode: "device" | "self";
	code: string;
	/** Shown above the camera at check-in, like "Wear your ARISTA shirt". */
	instructions: string;
};

export function toMeeting(record: RecordModel): Meeting {
	return {
		id: record.id,
		name: record.name,
		opensAt: record.opensAt,
		closesAt: record.closesAt,
		mode: record.mode === "self" ? "self" : "device",
		code: record.code ?? "",
		instructions: record.instructions ?? ""
	};
}

/** Hard-to-guess code for a self check-in link. */
export function newCheckInCode() {
	const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
	const bytes = crypto.getRandomValues(new Uint8Array(12));
	return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

/** PocketBase filter for meetings open right now. */
export function openNowFilter() {
	const now = new Date().toISOString().replace("T", " ");
	return `opensAt <= "${now}" && closesAt >= "${now}"`;
}

/**
 * A datetime-local value ("2026-10-15T15:30") plus the browser's
 * getTimezoneOffset() in minutes, as an exact instant. The server runs in UTC,
 * so the browser's offset is what makes 3:30 PM mean 3:30 PM in New York.
 */
export function localToIso(value: string, offsetMinutes: number) {
	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !Number.isFinite(offsetMinutes))
		return null;
	const asUtc = Date.parse(`${value}:00Z`);
	if (Number.isNaN(asUtc)) return null;
	return new Date(asUtc + offsetMinutes * 60_000).toISOString();
}
