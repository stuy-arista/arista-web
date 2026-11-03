<script lang="ts">
	import { onMount } from "svelte";
	import { fade } from "svelte/transition";

	export type Slide = { src: string; alt: string; caption?: string; position?: string };

	interface Props {
		slides: Slide[];
		label?: string;
		interval?: number;
	}
	let { slides, label = "Photos", interval = 6000 }: Props = $props();

	let index = $state(0);
	let paused = $state(false);
	let stopped = $state(false); // Set by the pause button or any control, until Play.
	let reduceMotion = $state(false);

	function choose(next: number) {
		stopped = true;
		go(next);
	}

	function go(next: number) {
		index = (next + slides.length) % slides.length;
	}

	// Autoplay pauses on hover or keyboard focus, and never runs for people who
	// prefer reduced motion.
	onMount(() => {
		reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const timer = window.setInterval(() => {
			if (!paused && !stopped && !reduceMotion && slides.length > 1 && !document.hidden)
				go(index + 1);
		}, interval);
		return () => window.clearInterval(timer);
	});
</script>

<section
	class="slideshow"
	aria-roledescription="carousel"
	aria-label={label}
	onmouseenter={() => (paused = true)}
	onmouseleave={() => (paused = false)}
	onfocusin={() => (paused = true)}
	onfocusout={() => (paused = false)}
>
	<div class="slideshow__frame">
		{#key index}
			<figure class="slideshow__slide" transition:fade={{ duration: reduceMotion ? 0 : 600 }}>
				<img
					src={slides[index].src}
					alt={slides[index].alt}
					style:object-position={slides[index].position ?? "center"}
					loading={index === 0 ? "eager" : "lazy"}
				/>
				{#if slides[index].caption}
					<figcaption>{slides[index].caption}</figcaption>
				{/if}
			</figure>
		{/key}
	</div>

	{#if slides.length > 1}
		<div class="slideshow__controls">
			<button
				type="button"
				class="slideshow__arrow"
				aria-label="Previous photo"
				onclick={() => choose(index - 1)}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
			</button>
			<div class="slideshow__dots" role="group" aria-label="Choose a photo">
				{#each slides as _, dot}
					<button
						type="button"
						class:active={dot === index}
						aria-label="Photo {dot + 1} of {slides.length}"
						aria-current={dot === index ? "true" : undefined}
						onclick={() => choose(dot)}
					></button>
				{/each}
			</div>
			<button
				type="button"
				class="slideshow__arrow"
				aria-label="Next photo"
				onclick={() => choose(index + 1)}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
			</button>
			{#if !reduceMotion}
				<button
					type="button"
					class="slideshow__arrow"
					aria-label={stopped ? "Play slideshow" : "Pause slideshow"}
					onclick={() => (stopped = !stopped)}
				>
					{#if stopped}
						<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" /></svg>
					{:else}
						<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12" /></svg>
					{/if}
				</button>
			{/if}
		</div>
	{/if}
</section>

<style>
	.slideshow {
		display: grid;
		gap: 0.85rem;
	}
	.slideshow__frame {
		position: relative;
		overflow: hidden;
		aspect-ratio: 16 / 9;
		border-radius: clamp(18px, 2.5vw, 28px);
		background: var(--wash);
	}
	.slideshow__slide {
		position: absolute;
		inset: 0;
		margin: 0;
	}
	.slideshow__slide img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	figcaption {
		position: absolute;
		left: 1rem;
		bottom: 1rem;
		max-width: calc(100% - 2rem);
		padding: 0.4rem 0.8rem;
		border-radius: var(--radius-pill);
		background: rgb(0 0 0 / 55%);
		color: #fff;
		font-size: var(--text-sm);
		font-weight: 500;
		backdrop-filter: blur(6px);
	}
	.slideshow__controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
	}
	.slideshow__arrow {
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
		transition: background-color var(--dur-2) var(--ease-out);
	}
	.slideshow__arrow:hover {
		background: var(--wash);
	}
	.slideshow__arrow svg {
		width: 1.1rem;
		height: 1.1rem;
		fill: none;
		stroke: currentcolor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 2;
	}
	.slideshow__dots {
		display: flex;
		gap: 0.15rem;
	}
	.slideshow__dots button {
		display: grid;
		place-items: center;
		width: 2.5rem;
		min-width: 0;
		height: 2.5rem;
		min-height: 0;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
	}
	.slideshow__dots button::before {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: var(--radius-pill);
		background: var(--line-strong);
		content: "";
		transition:
			width var(--dur-3) var(--ease-out),
			background-color var(--dur-3) var(--ease-out);
	}
	.slideshow__dots button.active::before {
		width: 1.4rem;
		background: var(--flame);
	}
</style>
