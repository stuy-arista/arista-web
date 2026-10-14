<script lang="ts">
	import { deserialize } from "$app/forms";
	import { invalidateAll } from "$app/navigation";
	import PhotoCapture from "$lib/components/PhotoCapture.svelte";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
	let photo = $state<Blob | null>(null);
	let message = $state("");
	let sending = $state(false);

	const meeting = $derived(data.meeting);
	const upcoming = $derived(!meeting.open && Date.now() < Date.parse(meeting.opensAt));

	function time(value: string) {
		return new Date(value).toLocaleString(undefined, {
			weekday: "long",
			hour: "numeric",
			minute: "2-digit"
		});
	}

	async function send() {
		if (!photo) return;
		sending = true;
		message = "";
		const body = new FormData();
		body.set("photo", photo, "check-in.jpg");
		const response = await fetch("", {
			method: "POST",
			body,
			headers: { "x-sveltekit-action": "true" }
		});
		const result = deserialize(await response.text());
		sending = false;
		if (result.type === "success") {
			await invalidateAll();
		} else {
			message =
				result.type === "failure"
					? String((result.data as { checkInError?: string })?.checkInError ?? "Couldn't check in.")
					: "Couldn't check in. Try again.";
		}
	}
</script>

<svelte:head><title>Check in: {meeting.name} | ARISTA</title></svelte:head>

<main class="page self">
	<header>
		<p class="self__meeting">{meeting.name}</p>
		<h1>Check in</h1>
	</header>

	{#if meeting.checkedInAt}
		<section class="panel self__card self__done" aria-live="polite">
			<h2>You're checked in, {data.name.split(" ")[0]}.</h2>
			<p class="muted">Checked in at {time(meeting.checkedInAt)}. You can close this page.</p>
		</section>
	{:else if !meeting.member}
		<section class="panel self__card">
			<h2>Only ARISTA members check in</h2>
			<p class="muted">
				You're signed in with a tutee account. If you're a member, sign in with your member account.
			</p>
		</section>
	{:else if !meeting.open}
		<section class="panel self__card">
			<h2>{upcoming ? "Check-in hasn't opened yet" : "Check-in is closed"}</h2>
			<p class="muted">
				{upcoming
					? `It opens ${time(meeting.opensAt)}. Scan the code again then.`
					: "If you were at the meeting, talk to an officer."}
			</p>
		</section>
	{:else}
		<section class="panel self__card">
			<p class="self__who">Checking in as <strong>{data.name}</strong></p>
			<PhotoCapture bind:photo bind:message busy={sending}>
				{#snippet submit()}
					<button class="btn btn-primary" type="button" onclick={send} disabled={sending}
						>{sending ? "Checking in…" : "Check in"}</button
					>
				{/snippet}
			</PhotoCapture>
		</section>
	{/if}
</main>

<style>
	.self {
		display: grid;
		gap: 1rem;
		align-content: start;
		max-width: 32rem;
		margin-inline: auto;
	}
	.self h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(2rem, 6vw, 2.75rem);
		line-height: 1.1;
	}
	.self__meeting {
		margin: 0 0 0.25rem;
		color: var(--muted);
		font-weight: 600;
	}
	.self__card {
		display: grid;
		gap: 0.9rem;
	}
	.self__card h2,
	.self__card p {
		margin: 0;
	}
	.self__done {
		text-align: center;
		padding-block: 2.5rem;
	}
</style>
