type Named = { name?: string; preferredName?: string } | null | undefined;

/** The name someone goes by: their preferred name, or their legal first name. */
export function firstName(person: Named): string {
	return person?.preferredName?.trim() || person?.name?.trim().split(/\s+/)[0] || "";
}

/** Their preferred name, unless it's empty or just their legal first name again. */
function distinctPreferred(person: Named): string {
	const preferred = person?.preferredName?.trim() ?? "";
	const legalFirst = person?.name?.trim().split(/\s+/)[0] ?? "";
	return preferred && preferred.toLowerCase() !== legalFirst.toLowerCase() ? preferred : "";
}

/** Full name for display, with the preferred name in place of the legal first name. */
export function displayName(person: Named): string {
	const legal = person?.name?.trim() ?? "";
	const preferred = distinctPreferred(person);
	if (!preferred) return legal;
	const rest = legal.split(/\s+/).slice(1).join(" ");
	return rest ? `${preferred} ${rest}` : preferred;
}

/**
 * Full legal name with the preferred name after it, for officer screens:
 * "Elizabeth Chung (Liz)". No parentheses when there's no different preferred name.
 */
export function officerName(person: Named): string {
	const legal = person?.name?.trim() ?? "";
	const preferred = distinctPreferred(person);
	return preferred ? `${legal} (${preferred})` : legal;
}

export function initials(person: Named): string {
	return displayName(person)
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0])
		.join("")
		.toUpperCase();
}
