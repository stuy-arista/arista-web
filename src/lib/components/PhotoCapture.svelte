<script lang="ts">
	import { onDestroy, onMount, tick, type Snippet } from "svelte";

	interface Props {
		/** The captured JPEG, ready to upload (null until a photo is taken). */
		photo?: Blob | null;
		/** Error to show under the photo; parents can set it too. */
		message?: string;
		/** Disables the buttons while the parent uploads. */
		busy?: boolean;
		/** Shown next to Retake once there's a photo (the parent's submit button). */
		submit: Snippet;
		/** Extra buttons that always show (like "Not me"). */
		extra?: Snippet;
	}
	let {
		photo = $bindable(null),
		message = $bindable(""),
		busy = false,
		submit,
		extra
	}: Props = $props();

	let video = $state<HTMLVideoElement>();
	let fileInput = $state<HTMLInputElement>();
	// Phones and tablets use their own camera app (real controls, natural
	// portrait shape); laptops get a live preview on the page.
	let nativeCamera = $state(false);
	let videoRatio = $state("4 / 3");
	let stream: MediaStream | null = null;
	let preview = $state("");

	onMount(async () => {
		nativeCamera = window.matchMedia("(pointer: coarse)").matches;
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
	});

	onDestroy(() => {
		stream?.getTracks().forEach((track) => track.stop());
		if (preview) URL.revokeObjectURL(preview);
	});

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
		message = "";
		if (preview) URL.revokeObjectURL(preview);
		preview = "";
		if (nativeCamera) fileInput?.click();
	}
</script>

<input
	bind:this={fileInput}
	class="hidden"
	type="file"
	accept="image/*"
	capture="user"
	onchange={fromCamera}
/>
<div
	class="camera"
	class:camera--empty={nativeCamera && !preview}
	style:aspect-ratio={nativeCamera || preview ? undefined : videoRatio}
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
<div class="camera__actions">
	{#if preview}
		{@render submit()}
		<button class="btn" type="button" onclick={retake} disabled={busy}>Retake</button>
	{:else}
		<button
			class="btn btn-primary"
			type="button"
			onclick={() => (nativeCamera ? fileInput?.click() : capture())}>Take photo</button
		>
	{/if}
	{@render extra?.()}
</div>

<style>
	.camera {
		overflow: hidden;
		border-radius: 14px;
		background: #111;
	}
	/* Show the whole photo at its own shape, capped so a portrait selfie still
	   fits on screen with the buttons. */
	.camera video,
	.camera img {
		display: block;
		width: 100%;
		max-height: 65vh;
		object-fit: contain;
	}
	/* The live preview reads like a mirror; the saved photo is flipped back. */
	.camera video {
		transform: scaleX(-1);
	}
	.camera--empty {
		display: grid;
		place-items: center;
		min-height: 10rem;
		padding: 1.5rem;
		background: var(--surface-sunken);
		color: var(--muted);
		text-align: center;
	}
	.camera--empty p {
		margin: 0;
	}
	.hidden {
		display: none !important;
	}
	.camera__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
</style>
