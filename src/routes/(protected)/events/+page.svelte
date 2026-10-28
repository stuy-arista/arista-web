<script lang="ts">
	import { untrack } from "svelte";
	import type { PageData } from "./$types";
	import "@event-calendar/core/index.css";
	import { superForm } from "sveltekit-superforms";
	import { isOnCommittee } from "$lib/isOnCommittee";
	import { currentUser } from "$lib/pocketbase";

	import { enhance } from "$app/forms";
	import { page } from "$app/state";
	import EventsCalendar from "$lib/components/EventsCalendar.svelte";
	import EventEditor from "$lib/components/EventEditor.svelte";
	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
	const formObj = superForm(untrack(() => data.form));
	let activeView = $state<"calendar" | "manage">("calendar");
	// Server's view of the user, so this doesn't depend on browser-side state.
	const canManageEvents = $derived(
		isOnCommittee((page.data.user ?? $currentUser) || undefined, "events")
	);

	// Open the create form with the chosen day filled in (3:00 to 5:00 PM).
	function createOn(day: Date) {
		const start = new Date(day);
		start.setHours(15, 0, 0, 0);
		const end = new Date(day);
		end.setHours(17, 0, 0, 0);
		formObj.form.update((form) => ({ ...form, start_time: start, end_time: end }));
		activeView = "manage";
		document.querySelector(".events__tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
	}
</script>

<svelte:head><title>Events | ARISTA</title></svelte:head>

<main class="page page--tool events">
	<header class="page-header">
		<div>
			<h1>Events</h1>
			<p>Sign up for service at school and around the city.</p>
		</div>
		<div class="page-header__actions">
			<a class="btn" href="/events/directory">Events directory</a>
		</div>
	</header>

	{#if canManageEvents}
		<div class="events__tabs" role="group" aria-label="Event views">
			<button
				type="button"
				aria-pressed={activeView === "calendar"}
				class:active={activeView === "calendar"}
				onclick={() => (activeView = "calendar")}>Calendar</button
			>
			<button
				type="button"
				aria-pressed={activeView === "manage"}
				class:active={activeView === "manage"}
				onclick={() => (activeView = "manage")}>Create an event</button
			>
		</div>
	{/if}

	{#if activeView === "calendar"}
		<section aria-label="ARISTA events calendar">
			<EventsCalendar
				events={data.events}
				onCreate={canManageEvents ? createOn : undefined}
				initialState={{
					month: page.url.searchParams.get("month"),
					view: page.url.searchParams.get("view"),
					place: page.url.searchParams.get("place"),
					open: page.url.searchParams.get("open"),
					day: page.url.searchParams.get("day")
				}}
			/>
		</section>
	{:else if canManageEvents}
		<section class="events__create panel" aria-labelledby="create-title">
			<h2 id="create-title" class="section-title">Create an event</h2>
			<form method="POST" action="?/create_event" use:enhance>
				<EventEditor {formObj} />
			</form>
		</section>
	{/if}
</main>

<style>
	.events__tabs {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid var(--line);
	}
	.events__tabs button {
		position: relative;
		min-height: 2.75rem;
		padding: 0.5rem 0.9rem;
		border: 0;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.9375rem;
		font-weight: 600;
		cursor: pointer;
		transition: color var(--dur-2) var(--ease-out);
	}
	.events__tabs button:hover {
		color: var(--ink);
	}
	.events__tabs button.active {
		color: var(--ink);
	}
	.events__tabs button.active::after {
		position: absolute;
		right: 0.9rem;
		bottom: -1px;
		left: 0.9rem;
		height: 2px;
		border-radius: 2px;
		background: var(--flame);
		content: "";
	}
	.events__create {
		max-width: 52rem;
	}
</style>
