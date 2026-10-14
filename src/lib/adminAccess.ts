import { isOnCommittee } from "$lib/isOnCommittee";

export const ADMIN_SECTIONS = ["people", "crediting", "tutoring", "credits", "attendance"] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export const ADMIN_SECTION_INFO: Record<
	AdminSection,
	{ label: string; href: string; description: string }
> = {
	people: {
		label: "People",
		href: "/admin",
		description: "Directory, member profiles, credits and strikes from a profile"
	},
	crediting: {
		label: "Crediting",
		href: "/admin/crediting",
		description: "Credit one person or many at once"
	},
	tutoring: {
		label: "Tutoring review",
		href: "/admin/tutoring",
		description: "Session hours, proof, and flags"
	},
	credits: {
		label: "Credits & semesters",
		href: "/admin/credits",
		description: "Requirements and the current semester"
	},
	attendance: {
		label: "Attendance",
		href: "/admin/attendance",
		description: "Run meeting check-in on this account's device"
	}
};

type MaybeUser = { committees?: string[]; adminSections?: string[] } | null | undefined;

/** Full admins can use every section and manage permissions. */
export function isAdmin(user: MaybeUser): boolean {
	return isOnCommittee(user as never, "admin");
}

export function canAccess(user: MaybeUser, section: AdminSection): boolean {
	return isAdmin(user) || Boolean(user?.adminSections?.includes(section));
}

export function accessibleSections(user: MaybeUser): AdminSection[] {
	return ADMIN_SECTIONS.filter((section) => canAccess(user, section));
}

export function hasAnyAdminAccess(user: MaybeUser): boolean {
	return accessibleSections(user).length > 0;
}
