import type { RecievedUser } from "$lib/db_types";
import {
	ADMIN_SECTION_INFO,
	accessibleSections,
	canAccess,
	isAdmin,
	type AdminSection
} from "$lib/adminAccess";
import { env } from "$env/dynamic/public";
import { env as privateEnv } from "$env/dynamic/private";
import { dev } from "$app/environment";
import { error, redirect, type Handle } from "@sveltejs/kit";
import PocketBase, { type RecordModel } from "pocketbase";
import { isIndexablePage } from "$lib/seo";

// Checking a session with PocketBase on every request is the biggest share of
// its work when hundreds of people are on the site, so reuse a check for a
// minute (per server instance). Changes to someone's account, like membership,
// show up within that minute.
const REFRESH_REUSE_MS = 60_000;
const recentRefreshes = new Map<string, { token: string; record: RecordModel; at: number }>();
function pruneRefreshes() {
	if (recentRefreshes.size < 5000) return;
	const cutoff = Date.now() - REFRESH_REUSE_MS;
	for (const [key, entry] of recentRefreshes) if (entry.at < cutoff) recentRefreshes.delete(key);
}

export const handle: Handle = async ({ event, resolve }) => {
	const pb = new PocketBase(env.PUBLIC_POCKETBASE_URL || "https://db.stuyarista.org");

	// PocketBase rate-limits per IP address, but every request from the site
	// reaches it from Vercel's servers. Pass the visitor's real address along
	// (nginx on the server only trusts it alongside the shared key), so limits
	// apply per person instead of to everyone at once.
	const proxyKey = privateEnv.PB_PROXY_SECRET;
	if (proxyKey) {
		let clientIp = "";
		try {
			clientIp = event.getClientAddress();
		} catch {
			// Not available (e.g. during prerendering).
		}
		if (clientIp) {
			pb.beforeSend = (url, options) => {
				options.headers = {
					...(options.headers as Record<string, string>),
					"X-Arista-Proxy-Key": proxyKey,
					"X-Arista-Client-IP": clientIp
				};
				return { url, options };
			};
		}
	}

	// before
	pb.authStore.loadFromCookie(event.request.headers.get("cookie") || "");
	if (pb.authStore.isValid) {
		const cookieToken = pb.authStore.token;
		const cached = recentRefreshes.get(cookieToken);
		if (cached && Date.now() - cached.at < REFRESH_REUSE_MS) {
			pb.authStore.save(cached.token, cached.record);
		} else {
			try {
				const { token, record } = await pb.collection("users").authRefresh({ requestKey: null });
				const entry = { token, record, at: Date.now() };
				recentRefreshes.set(cookieToken, entry);
				recentRefreshes.set(token, entry);
				pruneRefreshes();
			} catch (refreshError) {
				// Only a real "this session is no good" signs someone out. A slow or
				// busy server must not: the token in their cookie is still valid.
				const status = (refreshError as { status?: number }).status;
				if (status === 401 || status === 403 || status === 404) pb.authStore.clear();
			}
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
