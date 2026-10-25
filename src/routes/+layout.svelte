<script lang="ts">
	import Navbar from "$lib/components/Navbar.svelte";
	import LiveUpdates from "$lib/components/LiveUpdates.svelte";
	import SiteFooter from "$lib/components/SiteFooter.svelte";
	import Seo from "$lib/components/Seo.svelte";
	import "../app.css";
	import { AppShell, Modal } from "$lib/skeleton-compat";
	import { initializeStores } from "$lib/skeleton-compat";
	import { currentUser } from "$lib/pocketbase";
	import {
		accountThemeStorageKey,
		activeThemeOverride,
		publicThemePreference,
		type PublicThemePreference
	} from "$lib/theme";
	import { navigating, updated } from "$app/state";
	import { page } from "$app/state";
	import { onMount, tick } from "svelte";
	import { afterNavigate, beforeNavigate } from "$app/navigation";
	import { dev } from "$app/environment";
	import { inject as injectAnalytics } from "@vercel/analytics";
	import { injectSpeedInsights } from "@vercel/speed-insights/sveltekit";
	import type { LayoutData } from "./$types";

	interface Props {
		data: LayoutData;
		children?: import("svelte").Snippet;
	}

	let { data, children }: Props = $props();
	const isNavigating = $derived(!!navigating.to);
	let systemThemeIsDark = $state(false);
	const resolvedUser = $derived($currentUser ?? data.user);
	const themePreference = $derived(resolvedUser?.themePreference ?? "system");
	const visitorThemePreference = $derived($publicThemePreference);
	const activeTheme = $derived($activeThemeOverride);

	function applyTheme() {
		if (typeof document === "undefined") return;
		const isDark = activeTheme
			? activeTheme === "dark"
			: resolvedUser
				? themePreference === "dark" || (themePreference === "system" && systemThemeIsDark)
				: visitorThemePreference === "dark";
		document.documentElement.classList.toggle("dark", isDark);
		document.documentElement.style.colorScheme = isDark ? "dark" : "light";
	}

	initializeStores();

	// The page scrolls inside AppShell's scroll container, so the browser's own
	// scroll handling never touches it. Remember the position for each history
	// entry, restore it on Back/Forward, and start every new page at the top.
	const scroller = () => document.querySelector<HTMLElement>(".app-shell__scroll");
	const scrollKey = () => `arista-scroll:${history.state?.["sveltekit:history"] ?? "start"}`;
	// On Back/Forward the browser switches history entries before
	// beforeNavigate runs, so save under the entry we were actually on.
	let currentScrollKey = "";
	// A new version was deployed while this tab was open: load the next page
	// fresh instead of running the old code in this tab.
	beforeNavigate(({ willUnload, to }) => {
		if (updated.current && !willUnload && to?.url) {
			location.href = to.url.href;
		}
	});
	beforeNavigate(() => {
		try {
			if (currentScrollKey)
				sessionStorage.setItem(currentScrollKey, String(scroller()?.scrollTop ?? 0));
		} catch {
			// Storage can be unavailable (private mode); restoring is a nicety.
		}
	});
	afterNavigate(({ type, to }) => {
		currentScrollKey = scrollKey();
		if (type === "popstate") {
			let top = 0;
			try {
				top = Number(sessionStorage.getItem(scrollKey()) ?? 0);
			} catch {
				// Fall back to the top.
			}
			void tick().then(() => scroller()?.scrollTo({ top, left: 0 }));
			return;
		}
		if (to?.url.hash) return;
		scroller()?.scrollTo({ top: 0, left: 0 });
	});

	$effect(() => {
		currentUser.set(data.user ?? undefined);
	});

	onMount(() => {
		if (!dev && "serviceWorker" in navigator) {
			void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
		}

		if (data.user?.id) {
			const savedAccountTheme = window.localStorage.getItem(accountThemeStorageKey(data.user.id));
			if (savedAccountTheme === "light" || savedAccountTheme === "dark") {
				activeThemeOverride.set(savedAccountTheme);
			}
		}

		if (!dev) {
			injectAnalytics({ framework: "sveltekit" });
			injectSpeedInsights();
		}

		const savedPreference = window.localStorage.getItem("arista-public-theme");
		if (savedPreference === "light" || savedPreference === "dark") {
			publicThemePreference.set(savedPreference as PublicThemePreference);
		}
	});

	$effect(() => {
		if (typeof window === "undefined") return;
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const syncSystemTheme = () => (systemThemeIsDark = media.matches);
		syncSystemTheme();
		media.addEventListener("change", syncSystemTheme);
		return () => media.removeEventListener("change", syncSystemTheme);
	});

	$effect(() => {
		applyTheme();
	});
</script>

<svelte:head>
	<meta name="theme-color" media="(prefers-color-scheme: light)" content="#fcfbf8" />
	<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#141c35" />
</svelte:head>

<Seo url={page.url} status={page.status} signedIn={!!data.user} />

<Modal />
<LiveUpdates />

<!-- App Shell -->
<AppShell>
	{#snippet header()}
		<!-- App Bar -->
		<Navbar user={data.user} />
	{/snippet}
	<!-- Page Route Content -->
	{#key page.url.pathname}
		<div class="route-content" aria-busy={isNavigating}>
			{@render children?.()}
		</div>
	{/key}
	<SiteFooter />
</AppShell>

<style>
	.route-content {
		flex: 1 0 auto;
		min-width: 0;
		animation: route-arrive var(--dur-3) var(--ease-out) both;
	}
	/* A thin flame line at the top while the next page loads. It waits 150ms so
	 * fast navigations never flash it. */
	.route-content[aria-busy="true"]::before {
		position: fixed;
		top: 0;
		left: 0;
		z-index: 60;
		width: 100%;
		height: 3px;
		background: var(--flame);
		content: "";
		transform-origin: left;
		animation: route-progress 1.4s var(--ease-out) 150ms both;
	}
	@keyframes route-arrive {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes route-progress {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(0.85);
		}
	}
</style>
