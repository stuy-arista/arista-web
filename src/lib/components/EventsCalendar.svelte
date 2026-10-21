<script lang="ts">
	import { onMount } from "svelte";
	import { afterNavigate, replaceState } from "$app/navigation";
	import { page } from "$app/state";
	import type { RecievedEvent } from "$lib/db_types";
	import { calculateEventCredits } from "$lib/calculateCredits";

	type CalendarState = {
		month?: string | null;
		view?: string | null;
		place?: string | null;
		open?: string | null;
		day?: string | null;
	};

	interface Props {
		events: RecievedEvent[];
		initialState?: CalendarState;
	}

	let { events, initialState = {} }: Props = $props();
	const returnPositionKey = "arista-events-return-position";
	const monthPattern = /^(\d{4})-(\d{2})$/;

	function parseMonth(value?: string | null) {
		const match = value?.match(monthPattern);
		if (!match) return null;
		const year = Number(match[1]);
		const month = Number(match[2]);
		if (month < 1 || month > 12) return null;
		return new Date(year, month - 1, 1);
	}

	function isDateKey(value?: string | null) {
		return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
	}

	let selectedPlace = $state("All");
	let openOnly = $state(false);
	let listView = $state(false);
	let displayedMonth = $state(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
	let selectedDateKey = $state("");
	let mounted = $state(false);

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	// Each place keeps one hue everywhere it appears (legend, chips, badges).
	// The values live in CSS as --place-* so dark mode can lift them.
	const placeLegend = [
		{ place: "In Stuy", label: "Stuy" },
		{ place: "Queens", label: "Queens" },
		{ place: "Manhattan", label: "Manhattan" },
		{ place: "Brooklyn", label: "Brooklyn" },
		{ place: "Bronx", label: "Bronx" },
		{ place: "Staten Island", label: "Staten Is." },
		{ place: "Other", label: "Other" }
	];

	function eventDate(event: RecievedEvent) {
		return new Date(event.start_time);
	}

	function dateKey(date: Date) {
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
	}

	function eventState(event: RecievedEvent) {
		if (event.isComplete) return "complete";
		// Over once its end time passes, even before an organizer marks it complete.
		if (new Date(event.end_time) < new Date()) return "ended";
		return event.signupStatus ? "closed" : "open";
	}

	function eventTime(event: RecievedEvent) {
		const timeOptions: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
		const start = eventDate(event);
		const end = new Date(event.end_time);
		return `${start.toLocaleTimeString(undefined, timeOptions)}–${end.toLocaleTimeString(undefined, timeOptions)}`;
	}

	function placeClass(place: string) {
		return (place || "Other").toLowerCase().replaceAll(" ", "-");
	}

	function placeLabel(place: string) {
		return placeLegend.find((item) => item.place === place)?.label ?? place;
	}

	function stateLabel(event: RecievedEvent) {
		const state = eventState(event);
		if (state === "complete") return "Complete";
		if (state === "ended") return "Ended";
		return state === "closed" ? "Sign-ups closed" : "Open";
	}

	function isToday(date: Date) {
		return dateKey(date) === dateKey(today);
	}

	const summary = $derived.by(() => {
		const count =
			monthEvents.length === 0
				? "No events"
				: `${monthEvents.length} event${monthEvents.length === 1 ? "" : "s"}`;
		const place = selectedPlace === "All" ? "" : ` in ${selectedPlace}`;
		const open = openOnly ? " open for sign-ups" : "";
		return `${count}${place}${open} this month.`;
	});

	const monthLabel = $derived(
		displayedMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })
	);

	function eventsOn(date: Date) {
		const key = dateKey(date);
		return monthEvents.filter((event) => dateKey(eventDate(event)) === key);
	}

	function changeMonth(offset: number) {
		displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + offset, 1);
		selectedDateKey = dateKey(displayedMonth);
	}

	function applyStateToUrl(url: URL) {
		const month = `${displayedMonth.getFullYear()}-${String(displayedMonth.getMonth() + 1).padStart(2, "0")}`;
		url.searchParams.set("month", month);
		url.searchParams.set("view", listView ? "list" : "month");
		selectedPlace === "All"
			? url.searchParams.delete("place")
			: url.searchParams.set("place", selectedPlace);
		openOnly ? url.searchParams.set("open", "1") : url.searchParams.delete("open");
		selectedDateKey ? url.searchParams.set("day", selectedDateKey) : url.searchParams.delete("day");
	}

	function selectDayFromBox(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (target.closest("a, button")) return;
		const key = target.closest<HTMLElement>(".day")?.dataset.date;
		if (key) selectedDateKey = key;
	}

	function scrollContainer() {
		const container = document.querySelector<HTMLElement>(".app-shell__scroll");
		return container;
	}

	function saveReturnPosition() {
		const url = new URL(window.location.href);
		applyStateToUrl(url);
		if (routerReady) replaceState(url, page.state);
		window.sessionStorage.setItem(
			returnPositionKey,
			JSON.stringify({
				path: `${url.pathname}${url.search}`,
				scrollY: scrollContainer()?.scrollTop ?? window.scrollY
			})
		);
	}

	const filteredEvents = $derived(
		events.filter(
			(event) =>
				(selectedPlace === "All" || event.place === selectedPlace) &&
				(!openOnly ||
					(!event.signupStatus && !event.isComplete && new Date(event.end_time) >= today))
		)
	);
	const monthEvents = $derived(
		filteredEvents
			.filter(
				(event) =>
					eventDate(event).getFullYear() === displayedMonth.getFullYear() &&
					eventDate(event).getMonth() === displayedMonth.getMonth()
			)
			.sort((first, second) => eventDate(first).getTime() - eventDate(second).getTime())
	);
	const calendarDays = $derived.by(() => {
		const start = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), 1);
		start.setDate(start.getDate() - start.getDay());
		return Array.from(
			{ length: 42 },
			(_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
		);
	});
	const selectedDay = $derived(
		calendarDays.find((day) => dateKey(day) === selectedDateKey) ?? displayedMonth
	);
	const selectedEvents = $derived(eventsOn(selectedDay));

	onMount(() => {
		const restoredMonth = parseMonth(initialState.month);
		if (restoredMonth) displayedMonth = restoredMonth;
		if (initialState.place) selectedPlace = initialState.place;
		openOnly = initialState.open === "1";
		listView = initialState.view === "list";
		if (isDateKey(initialState.day)) selectedDateKey = initialState.day!;
		else if (
			displayedMonth.getFullYear() === today.getFullYear() &&
			displayedMonth.getMonth() === today.getMonth()
		)
			selectedDateKey = dateKey(today);

		const setResponsiveView = () => {
			if (!initialState.view) listView = window.innerWidth < 640;
		};
		setResponsiveView();
		mounted = true;

		try {
			const saved = JSON.parse(window.sessionStorage.getItem(returnPositionKey) ?? "null") as {
				path?: string;
				scrollY?: number;
			} | null;
			if (saved?.path === `${window.location.pathname}${window.location.search}`) {
				window.sessionStorage.removeItem(returnPositionKey);
				requestAnimationFrame(() =>
					requestAnimationFrame(() => {
						const container = scrollContainer();
						if (container) container.scrollTo({ top: saved.scrollY ?? 0 });
						else window.scrollTo(0, saved.scrollY ?? 0);
					})
				);
			}
		} catch {
			window.sessionStorage.removeItem(returnPositionKey);
		}

		window.addEventListener("resize", setResponsiveView);
		return () => window.removeEventListener("resize", setResponsiveView);
	});

	// SvelteKit's replaceState only works once the router has started.
	let routerReady = $state(false);
	afterNavigate(() => {
		routerReady = true;
	});

	$effect(() => {
		if (!mounted || !routerReady || typeof window === "undefined") return;
		const url = new URL(window.location.href);
		applyStateToUrl(url);
		if (`${url.pathname}${url.search}` !== `${window.location.pathname}${window.location.search}`) {
			replaceState(url, page.state);
		}
	});
</script>

{#snippet monthNav()}
	<div class="month-nav">
		<button
			type="button"
			class="month-arrow"
			aria-label="Previous month"
			onclick={() => changeMonth(-1)}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
		</button>
		<h2 aria-live="polite">{monthLabel}</h2>
		<button
			type="button"
			class="month-arrow"
			aria-label="Next month"
			onclick={() => changeMonth(1)}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
		</button>
	</div>
{/snippet}

<section class="planner" aria-label="ARISTA events">
	<div class="planner__toolbar">
		{@render monthNav()}
		<div class="planner__filters">
			<div class="segmented" role="group" aria-label="Calendar view">
				<button
					type="button"
					class:active={!listView}
					aria-pressed={!listView}
					onclick={() => (listView = false)}>Month</button
				>
				<button
					type="button"
					class:active={listView}
					aria-pressed={listView}
					onclick={() => (listView = true)}>List</button
				>
			</div>
			<label class="switch">
				<input type="checkbox" role="switch" bind:checked={openOnly} />
				<span class="switch__track" aria-hidden="true"></span>
				<span>Open only</span>
			</label>
			<label class="place-filter">
				<span class="sr-only">Place</span>
				<select bind:value={selectedPlace}>
					<option value="All">All places</option>
					{#each placeLegend as item}<option value={item.place}>{item.place}</option>{/each}
				</select>
			</label>
		</div>
	</div>

	{#if monthEvents.length}<p class="planner__summary">{summary}</p>{/if}

	{#if listView}
		<section class="event-list" aria-label={`${monthLabel} events`}>
			{#if monthEvents.length}
				<ul>
					{#each monthEvents as event (event.id)}
						{@const credits = calculateEventCredits(event)}
						<li>
							<a
								href={"/events/view/" + event.id}
								onclick={saveReturnPosition}
								class:is-muted={eventState(event) !== "open"}
							>
								<time datetime={eventDate(event).toISOString()}>
									<span>{eventDate(event).toLocaleDateString(undefined, { weekday: "short" })}</span
									>
									<b>{eventDate(event).getDate()}</b>
								</time>
								<div class="event-list__main">
									<strong>{event.name}</strong>
									<span>{eventTime(event)}{event.location ? `, ${event.location}` : ""}</span>
									<div class="event-list__meta">
										{#if event.place.trim()}
											<span class="place-tag place--{placeClass(event.place)}"
												>{placeLabel(event.place)}</span
											>
										{/if}
										<span class="badge state--{eventState(event)}">{stateLabel(event)}</span>
										<span
											class="event-list__count"
											aria-label="{event.signed_up
												.length} of {event.intendedVolunteers} volunteers signed up"
										>
											<svg viewBox="0 0 24 24" aria-hidden="true"
												><circle cx="9" cy="8" r="3.5" /><path
													d="M2.5 20v-.5a5.5 5.5 0 0 1 11 0v.5"
												/><path
													d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a5.5 5.5 0 0 1 3.5 5.3v.5"
												/></svg
											>{event.signed_up.length}/{event.intendedVolunteers} signed up
										</span>
									</div>
								</div>
								<!-- Credits mirror the date tile on the left. -->
								<div class="event-list__credits" class:is-empty={credits <= 0}>
									{#if credits > 0}
										<b>{credits}</b>
										<span>{credits === 1 ? "credit" : "credits"}</span>
									{/if}
								</div>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<div class="empty-state">
					{#if selectedPlace !== "All" || openOnly}
						<h3>Nothing matches these filters in {monthLabel}.</h3>
						<p>Try another month, or show every place and status.</p>
						<button
							type="button"
							class="btn"
							onclick={() => {
								selectedPlace = "All";
								openOnly = false;
							}}>Clear filters</button
						>
					{:else}
						<h3>No events in {monthLabel} yet.</h3>
						<p>New events show up here as soon as the events committee posts them.</p>
					{/if}
				</div>
			{/if}
		</section>
	{:else}
		<div class="calendar-layout">
			<section class="month" aria-label={`${monthLabel} calendar`}>
				<div class="legend" aria-label="Places">
					{#each placeLegend as item}
						<span class="legend__item place--{placeClass(item.place)}"><i></i>{item.label}</span>
					{/each}
				</div>
				<div class="month__weekdays" aria-hidden="true">
					{#each weekdays as weekday}<span>{weekday}</span>{/each}
				</div>
				<!-- Clicking anywhere in a day's box selects it. The number button stays
				     the keyboard-accessible way to do the same thing. -->
				<div class="month__days" role="presentation" onclick={selectDayFromBox}>
					{#each calendarDays.map( (day) => ({ day, dayEvents: eventsOn(day) }) ) as { day, dayEvents }}
						<div
							data-date={dateKey(day)}
							class="day"
							class:outside={day.getMonth() !== displayedMonth.getMonth()}
							class:selected={dateKey(day) === dateKey(selectedDay)}
							class:today={isToday(day)}
						>
							<button
								type="button"
								class="day__number"
								aria-label={`${day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}, ${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`}
								aria-pressed={dateKey(day) === dateKey(selectedDay)}
								onclick={() => (selectedDateKey = dateKey(day))}
								><span>{day.getDate()}</span></button
							>
							{#each dayEvents.slice(0, 2) as event}
								<a
									class="chip place--{placeClass(event.place)}"
									class:is-muted={eventState(event) !== "open"}
									href={"/events/view/" + event.id}
									onclick={saveReturnPosition}
									title={`${event.name}, ${stateLabel(event).toLowerCase()}`}
									><span>{event.name}</span><time>{eventTime(event)}</time></a
								>
							{/each}
							{#if dayEvents.length > 2}
								<button type="button" class="more" onclick={() => (selectedDateKey = dateKey(day))}
									>+{dayEvents.length - 2} more</button
								>
							{/if}
						</div>
					{/each}
				</div>
			</section>

			<aside class="day-panel" aria-live="polite" aria-label="Events on the selected day">
				<h3>
					{selectedDay.toLocaleDateString(undefined, {
						weekday: "long",
						month: "long",
						day: "numeric"
					})}
				</h3>
				{#if selectedEvents.length}
					<ul>
						{#each selectedEvents as event (event.id)}
							{@const credits = calculateEventCredits(event)}
							<li>
								<a
									href={"/events/view/" + event.id}
									onclick={saveReturnPosition}
									class="place--{placeClass(event.place)}"
									class:is-muted={eventState(event) !== "open"}
								>
									<div class="day-panel__info">
										<strong>{event.name}</strong>
										<span>{eventTime(event)}</span>
										{#if event.location}<span>{event.location}</span>{/if}
										<span class="day-panel__meta">
											<span class="badge state--{eventState(event)}">{stateLabel(event)}</span>
											<span class="event-list__count"
												><svg viewBox="0 0 24 24" aria-hidden="true"
													><circle cx="9" cy="8" r="3.5" /><path
														d="M2.5 20v-.5a5.5 5.5 0 0 1 11 0v.5"
													/><path
														d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a5.5 5.5 0 0 1 3.5 5.3v.5"
													/></svg
												>{event.signed_up.length}/{event.intendedVolunteers} signed up</span
											>
										</span>
									</div>
									{#if credits > 0}
										<div class="event-list__credits">
											<b>{credits}</b>
											<span>{credits === 1 ? "credit" : "credits"}</span>
										</div>
									{/if}
								</a>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="day-panel__empty">
						No events this day{openOnly || selectedPlace !== "All" ? " with these filters" : ""}.
					</p>
				{/if}
			</aside>
		</div>
	{/if}
</section>

<style>
	.planner {
		--place-in-stuy: #3a55a6;
		--place-queens: #2b7ea6;
		--place-manhattan: #2e7d57;
		--place-brooklyn: #ad4f78;
		--place-bronx: #b5761c;
		--place-staten-island: #b0503a;
		--place-other: #7c8092;
	}
	:global(.dark) .planner {
		--place-in-stuy: #9fb1f3;
		--place-queens: #7cc4e6;
		--place-manhattan: #78d3a5;
		--place-brooklyn: #eb9cc0;
		--place-bronx: #f2bd6a;
		--place-staten-island: #f0a08c;
		--place-other: #aab0c2;
	}
	.place--in-stuy {
		--place: var(--place-in-stuy);
	}
	.place--queens {
		--place: var(--place-queens);
	}
	.place--manhattan {
		--place: var(--place-manhattan);
	}
	.place--brooklyn {
		--place: var(--place-brooklyn);
	}
	.place--bronx {
		--place: var(--place-bronx);
	}
	.place--staten-island {
		--place: var(--place-staten-island);
	}
	.place--other {
		--place: var(--place-other);
	}

	/* Toolbar */
	.planner__toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.month-nav {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.month-nav h2 {
		min-width: 11ch;
		font-size: clamp(1.5rem, 2.5vw, var(--text-xl));
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.month-arrow {
		display: grid;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 50%;
		background: var(--surface);
		color: var(--ink);
		cursor: pointer;
		transition:
			background-color var(--dur-2) var(--ease-out),
			transform var(--dur-1) var(--ease-out);
	}
	.month-arrow:hover {
		background: var(--wash);
	}
	.month-arrow:active {
		transform: scale(0.94);
	}
	.month-arrow svg {
		width: 1.1rem;
		height: 1.1rem;
		fill: none;
		stroke: currentcolor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 2;
	}
	.planner__filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 1rem;
	}
	.segmented {
		display: inline-flex;
		padding: 0.25rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-pill);
		background: var(--surface-sunken);
	}
	.segmented button {
		min-height: 2.25rem;
		padding: 0.3rem 0.95rem;
		border: 0;
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: var(--text-sm);
		font-weight: 600;
		cursor: pointer;
		transition:
			background-color var(--dur-2) var(--ease-out),
			color var(--dur-2) var(--ease-out);
	}
	.segmented button.active {
		background: var(--surface);
		color: var(--ink);
		box-shadow:
			0 1px 2px rgb(22 39 90 / 12%),
			0 0 0 1px var(--line);
	}
	.switch {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		min-height: 2.75rem;
		font-size: var(--text-sm);
		font-weight: 600;
		cursor: pointer;
	}
	.switch input {
		position: absolute;
		width: 1px !important;
		height: 1px !important;
		opacity: 0;
	}
	.switch__track {
		position: relative;
		width: 2.5rem;
		height: 1.5rem;
		border-radius: var(--radius-pill);
		background: var(--line-strong);
		transition: background-color var(--dur-2) var(--ease-out);
	}
	.switch__track::after {
		position: absolute;
		top: 0.1875rem;
		left: 0.1875rem;
		width: 1.125rem;
		height: 1.125rem;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 1px 2px rgb(0 0 0 / 20%);
		content: "";
		transition: transform var(--dur-3) var(--ease-out);
	}
	.switch input:checked + .switch__track {
		background: var(--action);
	}
	.switch input:checked + .switch__track::after {
		transform: translateX(1rem);
	}
	.switch input:focus-visible + .switch__track {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.place-filter select {
		width: auto !important;
		min-height: 2.5rem !important;
		border-radius: var(--radius-pill) !important;
		font-size: var(--text-sm) !important;
		font-weight: 600 !important;
	}
	.planner__summary {
		margin: 0.75rem 0 1rem;
		color: var(--muted);
		font-size: var(--text-sm);
	}

	/* Month view */
	.calendar-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 19rem;
		gap: 1rem;
		align-items: start;
	}
	.month {
		overflow: hidden;
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		background: var(--surface);
	}
	.month__weekdays,
	.month__days {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
	}
	.month__weekdays {
		border-bottom: 1px solid var(--line);
	}
	.month__weekdays span {
		padding: 0.6rem 0.5rem;
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.day {
		display: grid;
		align-content: start;
		gap: 0.25rem;
		min-height: 7.25rem;
		padding: 0.35rem;
		overflow: hidden;
		border-right: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		transition: background-color var(--dur-1) ease;
	}
	.day:nth-child(7n) {
		border-right: 0;
	}
	.day:nth-last-child(-n + 7) {
		border-bottom: 0;
	}
	.day {
		cursor: pointer;
	}
	.day:hover:not(.selected) {
		background: color-mix(in srgb, var(--wash) 55%, transparent);
	}
	.day.outside {
		background: var(--surface-sunken);
	}
	.day.selected {
		background: var(--wash);
	}
	.day__number {
		display: grid;
		place-items: center;
		width: 1.9rem;
		height: 1.9rem;
		min-height: 0;
		min-width: 0;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: var(--text-sm);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
	}
	.day__number:hover {
		background: var(--seal-soft);
	}
	.day.outside .day__number {
		color: var(--subtle);
	}
	.day.today .day__number {
		background: var(--flame);
		color: #2a1a00;
	}
	.day.selected:not(.today) .day__number {
		background: var(--ink);
		color: var(--paper);
	}
	.chip {
		display: grid;
		/* minmax(0, 1fr) lets long names shrink and end in "…" instead of
		   overflowing the cell and getting cut off on the left. */
		grid-template-columns: minmax(0, 1fr);
		justify-items: start;
		min-width: 0;
		gap: 0.05rem;
		padding: 0.2rem 0.35rem 0.2rem 0.45rem;
		overflow: hidden;
		border-left: 3px solid var(--place);
		border-radius: 6px;
		background: color-mix(in srgb, var(--place) 13%, var(--surface));
		color: var(--ink);
		font-size: 0.7rem;
		font-weight: 600;
		line-height: 1.2;
		text-decoration: none;
		transition: background-color var(--dur-1) ease;
	}
	.chip:hover {
		background: color-mix(in srgb, var(--place) 24%, var(--surface));
	}
	.chip span,
	.chip time {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chip time {
		color: var(--muted);
		font-size: 0.65rem;
		font-weight: 500;
	}
	.chip.is-muted {
		opacity: 0.55;
	}
	.more {
		justify-self: start;
		min-height: 0;
		padding: 0.1rem 0.25rem;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: var(--link);
		font: inherit;
		font-size: 0.7rem;
		font-weight: 600;
		cursor: pointer;
	}
	.more:hover {
		text-decoration: underline;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--line);
		color: var(--muted);
		font-size: var(--text-xs);
	}
	.legend__item {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	.legend__item i {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: var(--place);
	}

	/* Day panel */
	.day-panel {
		position: sticky;
		top: 5.5rem;
		padding: 1.15rem;
		border-radius: var(--radius-panel);
		background: var(--surface-sunken);
	}
	.day-panel h3 {
		font-size: var(--text-lg);
	}
	.day-panel ul {
		display: grid;
		gap: 0.5rem;
		margin: 0.85rem 0 0;
		padding: 0;
		list-style: none;
	}
	.day-panel a {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: start;
		gap: 0.75rem;
		padding: 0.75rem 0.85rem;
		border-left: 3px solid var(--place);
		border-radius: var(--radius-field);
		background: var(--surface);
		color: var(--ink);
		text-decoration: none;
		transition: background-color var(--dur-2) var(--ease-out);
	}
	.day-panel a:hover {
		background: var(--wash);
	}
	.day-panel__info strong {
		font-weight: 650;
		line-height: 1.35;
	}
	.day-panel__info {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}
	.day-panel__info > span {
		color: var(--muted);
		font-size: var(--text-sm);
	}
	.day-panel__meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.35rem;
		color: var(--muted);
		font-size: var(--text-xs) !important;
	}
	.day-panel__empty {
		margin: 0.6rem 0 0;
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.state--open {
		background: var(--success-soft);
		color: var(--success);
	}
	.state--closed {
		background: var(--flame-soft);
		color: var(--flame-text);
	}
	.state--ended,
	.state--complete {
		background: var(--surface-sunken);
		color: var(--muted);
	}

	/* List view */
	.event-list ul {
		display: grid;
		margin: 0;
		padding: 0;
		overflow: hidden;
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		background: var(--surface);
		list-style: none;
	}
	.event-list li + li {
		border-top: 1px solid var(--line);
	}
	.event-list a {
		display: grid;
		grid-template-columns: 3.25rem minmax(0, 1fr) auto;
		gap: 1rem;
		align-items: center;
		padding: 0.85rem 1rem;
		color: var(--ink);
		text-decoration: none;
		transition: background-color var(--dur-2) var(--ease-out);
	}
	.event-list a:hover {
		background: var(--wash);
	}
	.event-list a.is-muted .event-list__main {
		opacity: 0.65;
	}
	.event-list time {
		display: grid;
		place-items: center;
		height: 3.25rem;
		border-radius: var(--radius-field);
		background: var(--surface-sunken);
		line-height: 1;
	}
	.event-list time span {
		color: var(--muted);
		font-size: 0.6875rem;
		font-weight: 600;
	}
	.event-list time b {
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 600;
	}
	.event-list__main {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}
	.event-list__main > strong {
		overflow: hidden;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.event-list__main > span {
		overflow: hidden;
		color: var(--muted);
		font-size: var(--text-sm);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.event-list__meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem 0.6rem;
		margin-top: 0.3rem;
		color: var(--muted);
		font-size: var(--text-xs);
	}
	.place-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.place-tag::before {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--place);
		content: "";
	}
	/* Credits tile: same size and shape as the date tile, at the other end. */
	.event-list__credits {
		display: grid;
		place-items: center;
		align-content: center;
		width: 4rem;
		height: 3.25rem;
		border-radius: var(--radius-field);
		background: var(--flame-soft);
		color: var(--flame-text);
		line-height: 1;
	}
	.event-list__credits b {
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.event-list__credits span {
		margin-top: 0.2rem;
		font-size: 0.6875rem;
		font-weight: 600;
	}
	.event-list__credits.is-empty {
		background: none;
	}
	a.is-muted .event-list__credits:not(.is-empty) {
		background: var(--surface-sunken);
		color: var(--muted);
	}
	.event-list__count {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.event-list__count svg {
		width: 0.95rem;
		height: 0.95rem;
		fill: none;
		stroke: currentcolor;
		stroke-width: 1.8;
		stroke-linecap: round;
	}

	@media (max-width: 980px) {
		.calendar-layout {
			grid-template-columns: 1fr;
		}
		.day-panel {
			position: static;
		}
	}
	@media (max-width: 640px) {
		.planner__toolbar {
			align-items: stretch;
			flex-direction: column;
		}
		.month-nav {
			justify-content: space-between;
		}
		.day {
			min-height: 4.5rem;
			padding: 0.2rem;
		}
		.chip time {
			display: none;
		}
		.chip {
			font-size: 0.625rem;
		}
		.event-list a {
			grid-template-columns: 3rem minmax(0, 1fr) auto;
			gap: 0.75rem;
		}
		.event-list__credits {
			width: 3.25rem;
		}
		.event-list__credits.is-empty {
			width: 0;
		}
	}
</style>
