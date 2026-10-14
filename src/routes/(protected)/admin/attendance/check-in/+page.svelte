<script lang="ts">
	import { deserialize } from "$app/forms";
	import { onDestroy } from "svelte";
	import PhotoCapture from "$lib/components/PhotoCapture.svelte";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	type Member = { id: string; name: string; graduationYear: number };
	type Step = "search" | "camera" | "sending" | "done";

	let meetingId = $state("");
	$effect(() => {
		if (!data.openMeetings.some((meeting) => meeting.id === meetingId)) {
			meetingId = data.openMeetings[0]?.id ?? "";
		}
	});
	const meeting = $derived(data.openMeetings.find((entry) => entry.id === meetingId));

	let step = $state<Step>("search");
	let query = $state("");
	let results = $state<Member[]>([]);
	let searching = $state(false);
	let member = $state<Member | null>(null);
	let message = $state("");

	let photo = $state<Blob | null>(null);
	let resetTimer: ReturnType<typeof setTimeout> | undefined;

	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	function search(value: string) {
		query = value;
		clearTimeout(searchTimer);
		message = "";
		const q = value.trim();
		if (q.length < 2) {
			results = [];
			return;
		}
		searchTimer = setTimeout(async () => {
			searching = true;
			try {
				const response = await fetch(
					`/admin/attendance/check-in/members?q=${encodeURIComponent(q)}`
				);
				const found: Member[] = response.ok ? await response.json() : [];
				// A slower, older search mustn't overwrite the latest one.
				if (q === query.trim()) results = found;
			} finally {
				searching = false;
			}
		}, 250);
	}

	function choose(person: Member) {
		member = person;
		message = "";
		photo = null;
		step = "camera";
	}

	async function send() {
		if (!photo || !member || !meetingId) return;
		step = "sending";
		const body = new FormData();
		body.set("meeting", meetingId);
		body.set("user", member.id);
		body.set("photo", photo, "check-in.jpg");
		const response = await fetch("?/check_in", {
			method: "POST",
			body,
			headers: { "x-sveltekit-action": "true" }
		});
		const result = deserialize(await response.text());
		if (result.type === "success") {
			step = "done";
			resetTimer = setTimeout(reset, 4000);
		} else {
			step = "camera";
			message =
				result.type === "failure"
					? String((result.data as { checkInError?: string })?.checkInError ?? "Couldn't check in.")
					: "Couldn't check in. Try again.";
		}
	}

	function reset() {
		clearTimeout(resetTimer);
		photo = null;
		member = null;
		query = "";
		results = [];
		message = "";
		step = "search";
	}

	onDestroy(() => {
		clearTimeout(resetTimer);
		clearTimeout(searchTimer);
	});
</script>

<svelte:head><title>Check-in | ARISTA</title></svelte:head>

<main class="page kiosk">
	<a class="back" href="/admin/attendance">
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
		Attendance
	</a>
	{#if !data.openMeetings.length}
		<section class="panel kiosk__card">
			<h1>No meeting is open</h1>
			<p class="muted">An admin needs to open a meeting before members can check in.</p>
			<a class="btn" href="/admin/attendance">Back to attendance</a>
		</section>
	{:else}
		<header class="kiosk__head">
			{#if data.openMeetings.length > 1}
				<label>
					<span class="sr-only">Meeting</span>
					<select bind:value={meetingId} disabled={step !== "search"}>
						{#each data.openMeetings as option (option.id)}
							<option value={option.id}>{option.name}</option>
						{/each}
					</select>
				</label>
			{:else}
				<p class="kiosk__meeting">{meeting?.name}</p>
			{/if}
			<h1>Check in</h1>
		</header>

		{#if step === "search"}
			<section class="panel kiosk__card">
				<label class="kiosk__search">
					<span class="field-label">Your OSIS or name</span>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						bind:value={query}
						oninput={(event) => search(event.currentTarget.value)}
						autocomplete="off"
						autocapitalize="words"
						spellcheck="false"
						placeholder="123456789 or Jane Doe"
						autofocus
					/>
				</label>
				{#if results.length}
					<ul class="kiosk__results">
						{#each results as person (person.id)}
							<li>
								<button type="button" onclick={() => choose(person)}>
									<strong>{person.name}</strong>
									<span>Class of {person.graduationYear}</span>
								</button>
							</li>
						{/each}
					</ul>
				{:else if query.trim().length >= 2 && !searching}
					<p class="muted">
						No member found. Check the spelling, or try your OSIS. Only ARISTA members can check in.
					</p>
				{/if}
			</section>
		{:else if step === "camera" || step === "sending"}
			<section class="panel kiosk__card">
				<p class="kiosk__who">Checking in <strong>{member?.name}</strong></p>
				<PhotoCapture bind:photo bind:message busy={step === "sending"}>
					{#snippet submit()}
						<button
							class="btn btn-primary"
							type="button"
							onclick={send}
							disabled={step === "sending"}
							>{step === "sending" ? "Checking in…" : "Check in"}</button
						>
					{/snippet}
					{#snippet extra()}
						<button
							class="btn btn-ghost"
							type="button"
							onclick={reset}
							disabled={step === "sending"}>Not me</button
						>
					{/snippet}
				</PhotoCapture>
			</section>
		{:else}
			<section class="panel kiosk__card kiosk__done" aria-live="polite">
				<h2>You're checked in, {member?.name.split(" ")[0]}.</h2>
				<p class="muted">This screen resets for the next person in a few seconds.</p>
				<button class="btn" type="button" onclick={reset}>Next person</button>
			</section>
		{/if}
	{/if}
</main>

<style>
	.back {
		display: inline-flex;
		align-items: center;
		justify-self: start;
		gap: 0.25rem;
		min-height: 2.75rem;
		margin-left: -0.4rem;
		padding: 0 0.6rem 0 0.4rem;
		border-radius: var(--radius-pill);
		color: var(--muted);
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: none;
	}
	.back:hover {
		background: var(--wash);
		color: var(--ink);
	}
	.back svg {
		width: 1.1rem;
		height: 1.1rem;
		fill: none;
		stroke: currentcolor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 2;
	}
	.kiosk {
		display: grid;
		gap: 1rem;
		align-content: start;
		max-width: 36rem;
		margin-inline: auto;
	}
	.kiosk__head h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(2rem, 6vw, 2.75rem);
		line-height: 1.1;
	}
	.kiosk__meeting {
		margin: 0 0 0.25rem;
		color: var(--muted);
		font-weight: 600;
	}
	.kiosk__card {
		display: grid;
		gap: 0.9rem;
	}
	.kiosk__card h1,
	.kiosk__card h2,
	.kiosk__card p {
		margin: 0;
	}
	.kiosk__search {
		display: grid;
		gap: 0.35rem;
	}
	.kiosk__search input {
		min-height: 3.25rem;
		font-size: 1.15rem;
	}
	.kiosk__results {
		display: grid;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.kiosk__results button {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 1rem;
		width: 100%;
		min-height: 3.25rem;
		padding: 0.6rem 0.9rem;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.kiosk__results button:hover,
	.kiosk__results button:focus-visible {
		border-color: var(--seal, var(--ink));
	}
	.kiosk__results span {
		color: var(--muted);
		font-size: var(--text-sm);
	}
	.kiosk__done {
		text-align: center;
		justify-items: center;
		padding-block: 2.5rem;
	}
</style>
