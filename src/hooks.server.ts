import type { RecievedUser } from "$lib/db_types";
import {
	ADMIN_SECTION_INFO,
	accessibleSections,
	canAccess,
	isAdmin,
	type AdminSection
} from "$lib/adminAccess";
import { env } from "$env/dynamic/public";
import { dev } from "$app/environment";
import { error, redirect, type Handle } from "@sveltejs/kit";
import PocketBase from "pocketbase";
import { isIndexablePage } from "$lib/seo";

export const handle: Handle = async ({ event, resolve }) => {
	const pb = new PocketBase(env.PUBLIC_POCKETBASE_URL || "https://db.stuyarista.org");

	// before
	pb.authStore.loadFromCookie(event.request.headers.get("cookie") || "");
	if (pb.authStore.isValid) {
		try {
			await pb.collection("users").authRefresh({ requestKey: null });
		} catch (_) {
			pb.authStore.clear();
		}
	}

	event.locals.pb = pb;
	event.locals.user = structuredClone(pb.authStore.model) as RecievedUser | null;

	if (
		!["/robots.txt", "/sitemap.xml"].includes(event.url.pathname) &&
		!isIndexablePage(event.url, 200, !!event.locals.user)
	) {
		event.setHeaders({ "X-Robots-Tag": "noindex, nofollow" });
	}

	if (
		event.url.pathname.startsWith("/events") ||
		event.url.pathname.startsWith("/settings") ||
		event.url.pathname.startsWith("/tutoring") ||
		event.url.pathname.startsWith("/apply") ||
		event.url.pathname.startsWith("/leaderboard") ||
		event.url.pathname.startsWith("/attendance")
	) {
		if (!event.locals.user) {
			// if not logged in, redirect
			// Redirection inspired by https://www.youtube.com/watch?v=ieECVME5ZLU
			// Everyone lands on sign in. Returning students are the common case, and the
			// sign-in page links to registration with the same destination for new ones.
			const fromUrl = event.url.pathname + event.url.search;
			let message = "Sign in to continue.";
			if (event.url.pathname.startsWith("/apply")) {
				message =
					"Sign in to apply. New to ARISTA? Create a tutee account first. Current freshmen, sophomores, and juniors with a 92 overall average or higher are eligible.";
			}
			if (event.url.pathname.startsWith("/attendance")) {
				message = "Sign in to check in to the meeting.";
			}
			if (event.url.pathname.startsWith("/tutoring")) {
				message = "Sign in to request tutoring. New here? Create a free account in a minute.";
			}
			throw redirect(
				303,
				`/login?redirectTo=${encodeURIComponent(fromUrl)}&message=${encodeURIComponent(message)}`
			);
		}
	}

	if (event.url.pathname.startsWith("/events") && event.locals.user && !event.locals.user.member) {
		error(403, "Tutee accounts cannot access the events area.");
	}

	if (
		(event.url.pathname.startsWith("/leaderboard") ||
			event.url.pathname.startsWith("/api/leaderboard")) &&
		event.locals.user &&
		!event.locals.user.member
	) {
		error(403, "The leaderboard is for ARISTA members.");
	}

	if (event.url.pathname.startsWith("/apply") && event.locals.user && event.locals.user.member) {
		error(403, "Current ARISTA members cannot access the application page.");
	}

	// Forbid non-admins from entering admin routes
	if (event.url.pathname.startsWith("/admin")) {
		if (!event.locals.user) {
			const fromUrl = event.url.pathname + event.url.search;
			const message = "Sign in to open the admin area.";
			throw redirect(
				303,
				`/login?redirectTo=${encodeURIComponent(fromUrl)}&message=${encodeURIComponent(message)}`
			);
		}
		// Each admin page belongs to a section. Admins see everything; anyone else
		// only the sections an admin has granted them on the Permissions page.
		const user = event.locals.user as RecievedUser;
		const path = event.url.pathname;
		const section: AdminSection | "permissions" = path.startsWith("/admin/permissions")
			? "permissions"
			: path.startsWith("/admin/crediting")
				? "crediting"
				: path.startsWith("/admin/tutoring")
					? "tutoring"
					: path.startsWith("/admin/credits")
						? "credits"
						: path.startsWith("/admin/attendance")
							? "attendance"
							: "people";
		const allowed = section === "permissions" ? isAdmin(user) : canAccess(user, section);
		if (!allowed) {
			const fallback = accessibleSections(user)[0];
			if (path === "/admin" && fallback) throw redirect(303, ADMIN_SECTION_INFO[fallback].href);
			error(403, "You don't have access to this part of the admin area. Ask an admin to grant it.");
		}
	}

	const response = await resolve(event);

	// after
	response.headers.set(
		"set-cookie",
		pb.authStore.exportToCookie({ httpOnly: true, secure: !dev, sameSite: "lax" })
	);

	response.headers.set("X-Content-Type-Options", "nosniff");
	response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
	response.headers.set("X-Frame-Options", "DENY");

	return response;
};
