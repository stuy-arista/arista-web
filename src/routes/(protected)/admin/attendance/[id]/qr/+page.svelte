<script lang="ts">
	import type { PageData } from "./$types";
	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Check in: {data.name} | ARISTA</title></svelte:head>

<main class="qr-screen">
	<h1>{data.name}</h1>
	<p>Scan to check in</p>
	<!-- The SVG comes from our own QR generator, not user input. -->
	<div class="qr-screen__code">{@html data.qr}</div>
	<p class="qr-screen__link">{data.link.replace(/^https?:\/\//, "")}</p>
</main>

<style>
	.qr-screen {
		display: grid;
		justify-items: center;
		gap: 0.75rem;
		min-height: 80vh;
		padding: 2rem 1rem;
		text-align: center;
		align-content: center;
	}
	.qr-screen h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(2rem, 5vw, 3.5rem);
	}
	.qr-screen p {
		margin: 0;
		color: var(--muted);
		font-size: clamp(1.1rem, 2.5vw, 1.5rem);
	}
	.qr-screen__code {
		width: min(70vh, 85vw);
		padding: 1rem;
		border-radius: 16px;
		background: #fff;
	}
	.qr-screen__code :global(svg) {
		display: block;
		width: 100%;
		height: auto;
	}
	.qr-screen__link {
		overflow-wrap: anywhere;
		font-size: var(--text-sm) !important;
	}
</style>
