<script lang="ts">
	import { deserialize } from "$app/forms";
	import { onDestroy, onMount, tick } from "svelte";
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

	let video = $state<HTMLVideoElement>();
	let fileInput = $state<HTMLInputElement>();
	// Phones and tablets use their own camera app (real controls, natural
	// portrait shape); laptops get a live preview on the page.
	let nativeCamera = $state(false);
	onMount(() => {
		nativeCamera = window.matchMedia("(pointer: coarse)").matches;
	});
	let videoRatio = $state("4 / 3");
	let stream: MediaStream | null = null;
	let photo = $state<Blob | null>(null);
	let preview = $state("");
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

	async function choose(person: Member) {
		member = person;
		step = "camera";
		message = "";
		photo = null;
		preview = "";
		if (nativeCamera) return;
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: "user", width: { ideal: 1280 } },
				audio: false
			});
			await tick();
			if (video) {
				video.srcObject = stream;
				await video.play();
				// Match the box to the camera instead of cropping it.
				if (video.videoWidth) videoRatio = `${video.videoWidth} / ${video.videoHeight}`;
			}
		} catch {
			message = "The camera didn't start. Allow camera access for this site and try again.";
		}
	}

	function stopCamera() {
		stream?.getTracks().forEach((track) => track.stop());
		stream = null;
	}

	// Shrink to at most 720px on the long side, as JPEG (~100 KB), before upload.
	function shrink(source: CanvasImageSource, width: number, height: number, mirror: boolean) {
		const scale = Math.min(1, 720 / Math.max(width, height));
		const canvas = document.createElement("canvas");
		canvas.width = Math.round(width * scale);
		canvas.height = Math.round(height * scale);
		const context = canvas.getContext("2d");
		if (!context) return;
		if (mirror) {
			// The live preview is mirrored; flip it back so the photo isn't.
			context.translate(canvas.width, 0);
			context.scale(-1, 1);
		}
		context.drawImage(source, 0, 0, canvas.width, canvas.height);
		canvas.toBlob(
			(blob) => {
				if (!blob) return;
				photo = blob;
				if (preview) URL.revokeObjectURL(preview);
				preview = URL.createObjectURL(blob);
			},
			"image/jpeg",
			0.8
		);
	}

	function capture() {
		if (!video || !video.videoWidth) return;
		shrink(video, video.videoWidth, video.videoHeight, true);
	}

	// Photo from the phone's camera app. It has to be fresh: a picture more than
	// two minutes old (say, picked from the library) isn't accepted.
	async function fromCamera(event: Event & { currentTarget: HTMLInputElement }) {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = "";
		if (!file) return;
		message = "";
		if (!file.type.startsWith("image/")) {
			message = "That isn't a photo. Take a new one.";
			return;
		}
		if (Date.now() - file.lastModified > 2 * 60_000) {
			message = "Use a new photo taken just now, not one from your library.";
			return;
		}
		try {
			// createImageBitmap applies the photo's rotation, so it stays upright.
			const bitmap = await createImageBitmap(file);
			shrink(bitmap, bitmap.width, bitmap.height, false);
			bitmap.close();
		} catch {
			message = "Couldn't read that photo. Try again.";
		}
	}

	function retake() {
		photo = null;
		if (preview) URL.revokeObjectURL(preview);
		preview = "";
	}

	async function submit() {
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
			stopCamera();
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
		stopCamera();
		retake();
		member = null;
		query = "";
		results = [];
		message = "";
		step = "search";
	}

	onDestroy(() => {
		stopCamera();
		clearTimeout(resetTimer);
		clearTimeout(searchTimer);
	});
</script>

<svelte:head><title>Check-in | ARISTA</title></svelte:head>

<main class="page kiosk">
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
				<input
					bind:this={fileInput}
					class="hidden"
					type="file"
					accept="image/*"
					capture="user"
					onchange={fromCamera}
				/>
				<div
					class="kiosk__camera"
					class:kiosk__camera--empty={nativeCamera && !preview}
					style:aspect-ratio={nativeCamera ? undefined : videoRatio}
				>
					{#if nativeCamera && !preview}
						<p>Take a selfie so we know it's you.</p>
					{:else if !nativeCamera}
						<!-- svelte-ignore a11y_media_has_caption -->
						<video bind:this={video} playsinline muted class:hidden={!!preview}></video>
					{/if}
					{#if preview}<img src={preview} alt="Preview of your check-in" />{/if}
				</div>
				{#if message}<p class="field-error" role="alert">{message}</p>{/if}
				<div class="kiosk__actions">
					{#if preview}
						<button
							class="btn btn-primary"
							type="button"
							onclick={submit}
							disabled={step === "sending"}
							>{step === "sending" ? "Checking in…" : "Check in"}</button
						>
						<button
							class="btn"
							type="button"
							onclick={() => {
								retake();
								if (nativeCamera) fileInput?.click();
							}}
							disabled={step === "sending"}>Retake</button
						>
					{:else}
						<button
							class="btn btn-primary"
							type="button"
							onclick={() => (nativeCamera ? fileInput?.click() : capture())}>Take photo</button
						>
					{/if}
					<button class="btn btn-ghost" type="button" onclick={reset} disabled={step === "sending"}
						>Not me</button
					>
				</div>
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
	.kiosk__camera {
		overflow: hidden;
		border-radius: 14px;
		background: #111;
	}
	/* Show the whole photo at its own shape, capped so a portrait selfie
	   still fits on screen with the buttons. */
	.kiosk__camera video,
	.kiosk__camera img {
		display: block;
		width: 100%;
		max-height: 65vh;
		object-fit: contain;
	}
	.kiosk__camera--empty {
		display: grid;
		place-items: center;
		min-height: 10rem;
		padding: 1.5rem;
		background: var(--surface-sunken);
		color: var(--muted);
		text-align: center;
	}
	.kiosk__camera--empty p {
		margin: 0;
	}
	/* Selfie preview reads like a mirror; the saved photo is flipped back. */
	.kiosk__camera video {
		transform: scaleX(-1);
	}
	.hidden {
		display: none !important;
	}
	.kiosk__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
	.kiosk__done {
		text-align: center;
		justify-items: center;
		padding-block: 2.5rem;
	}
</style>
