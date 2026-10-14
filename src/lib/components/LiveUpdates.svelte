<script lang="ts">
	import { onMount } from "svelte";
	import { invalidateAll } from "$app/navigation";
	import { page } from "$app/state";

	// Keeps pages current without a refresh. Every 15 seconds while the tab is
	// visible (and when you come back to it), ask whether anything this page
	// shows has changed; if so, reload the page's data in place. It waits while
	// someone is typing or has unsaved edits, since reloading resets forms.

	const INTERVAL = 15_000;

	// Which data each part of the site shows. Pages not listed don't poll.
	const sources: [prefix: string, collections: string[]][] = [
		["/admin/attendance", ["attendance", "meetings"]],
		["/admin/tutoring", ["tutoringSessions", "tutoringMessages", "credits"]],
		["/admin/credits", ["creditSemesters", "creditRequirements"]],
		["/admin", ["users", "credits", "strikes", "tutoringSessions"]],
		["/attendance", ["attendance", "meetings"]],
		["/events", ["events", "credits"]],
		["/tutoring", ["tutoringRequests", "tutoringSessions", "credits"]],
		["/leaderboard", ["credits", "users"]],
		["/", ["credits", "strikes", "events"]]
	];
	function collectionsFor(path: string) {
		const match = sources.find(([prefix]) =>
			prefix === "/" ? path === "/" : path === prefix || path.startsWith(prefix + "/")
		);
		return match?.[1] ?? [];
	}

	// Fields someone has actually typed in or changed since the page loaded or
	// their form was last submitted. (Comparing values to their defaults doesn't
	// work: fields the page fills in itself look "changed" after navigation.)
	let edited = new Set<Element>();
	function onEdit(event: Event) {
		if (event.isTrusted && event.target instanceof Element) edited.add(event.target);
	}
	function onSubmit(event: Event) {
		const form = event.target;
		if (form instanceof HTMLFormElement) {
			for (const field of edited) if (form.contains(field)) edited.delete(field);
		}
		if (pending) setTimeout(check, 300);
	}

	// Something focused, half-typed, or open in a dialog means "not now".
	function busy() {
		const active = document.activeElement;
		if (active?.matches("input:not([type=hidden]), textarea, select, [contenteditable]"))
			return true;
		if (document.querySelector("dialog[open]")) return true;
		for (const field of edited) {
			if (field.isConnected) return true;
			edited.delete(field);
		}
		return false;
	}

	let signature = "";
	let signaturePath = "";
	let pending = false;
	let checking = false;

	async function check() {
		if (checking || document.visibilityState !== "visible") return;
		const path = page.url.pathname;
		const collections = collectionsFor(path);
		if (!collections.length || !page.data.user) return;
		checking = true;
		try {
			const response = await fetch(`/api/live?c=${collections.join(",")}`, { cache: "no-store" });
			if (!response.ok) return;
			const next = JSON.stringify(await response.json());
			if (path !== signaturePath) {
				// New page: its data is fresh from navigation, so just remember it.
				signaturePath = path;
				signature = next;
				return;
			}
			if (next !== signature) {
				signature = next;
				pending = true;
			}
			if (pending && !busy()) {
				pending = false;
				await invalidateAll();
			}
		} catch {
			// Offline or a blip: try again next time.
		} finally {
			checking = false;
		}
	}

	onMount(() => {
		const timer = setInterval(check, INTERVAL);
		const onVisible = () => document.visibilityState === "visible" && check();
		// Catch up right after someone leaves a field, if a change came in meanwhile.
		const onSettle = () => pending && setTimeout(check, 300);
		document.addEventListener("visibilitychange", onVisible);
		window.addEventListener("focus", onVisible);
		document.addEventListener("focusout", onSettle);
		document.addEventListener("input", onEdit, true);
		document.addEventListener("change", onEdit, true);
		document.addEventListener("submit", onSubmit, true);
		check();
		return () => {
			clearInterval(timer);
			document.removeEventListener("visibilitychange", onVisible);
			window.removeEventListener("focus", onVisible);
			document.removeEventListener("focusout", onSettle);
			document.removeEventListener("input", onEdit, true);
			document.removeEventListener("change", onEdit, true);
			document.removeEventListener("submit", onSubmit, true);
		};
	});

	// Take a fresh baseline whenever the page changes.
	$effect(() => {
		void page.url.pathname;
		edited = new Set();
		signaturePath = "";
		check();
	});
</script>
