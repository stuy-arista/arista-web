<script lang="ts">
	import type { PageData } from "./$types";
	import { currentUser } from "$lib/pocketbase";
	import StrikesDisplay from "$lib/components/StrikesDisplay.svelte";
	import SignedUpEventsDisplay from "$lib/components/SignedUpEventsDisplay.svelte";
	import PWAInstall from "$lib/components/PWAInstall.svelte";
	import SemesterCreditPanel from "$lib/components/SemesterCreditPanel.svelte";
	import PillarsTemple from "$lib/components/PillarsTemple.svelte";
	import { firstName as getFirstName } from "$lib/displayName";

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const firstName = $derived(getFirstName($currentUser));
	const greeting = $derived.by(() => {
		const hour = new Date().getHours();
		if (hour < 5) return "Up late";
		if (hour < 12) return "Good morning";
		if (hour < 17) return "Good afternoon";
		return "Good evening";
	});

	const waysIn = [
		{
			title: "Get help in any class",
			body: "Tell us the class and topic, pick times that work, and a tutor will reach out.",
			href: "/tutoring",
			action: "Request tutoring"
		},
		{
			title: "Study with what we've made",
			body: "Study guides, Cram Central, and freshman essentials, written by Stuyvesant students.",
			href: "/resources",
			action: "Browse resources"
		},
		{
			title: "Serve the city with us",
			body: "ARISTA members volunteer with partners across New York City, from food pantries to park cleanups and more.",
			href: "/faq",
			action: "How membership works"
		}
	];
</script>

<svelte:head>
	<title>ARISTA | Stuyvesant High School</title>
</svelte:head>

{#if $currentUser?.member}
	<main class="page dashboard">
		<header class="page-header">
			<div>
				<h1>{greeting}, {firstName}.</h1>
			</div>
			<div class="page-header__actions">
				<a class="btn btn-primary" href="/events">Find events</a>
				<a class="btn" href="/tutoring">Open tutoring</a>
			</div>
		</header>

		{#if data?.hasContactInfo === false}
			<section class="tutee__contact" aria-labelledby="member-contact-title">
				<div>
					<h2 id="member-contact-title">Add your contact info</h2>
					<p>
						Tutees see it once you claim their request, so they can reach you to plan a session. A
						phone number, Instagram, or Discord works.
					</p>
				</div>
				<a class="btn btn-primary" href="/settings#about-you-title">Add contact info</a>
			</section>
		{/if}

		<SemesterCreditPanel
			credits={data.credits ?? []}
			user={$currentUser}
			semesters={data.creditSemesters ?? []}
			activeSemesterId={data.activeCreditSemester?.id}
			requirements={data.creditRequirements ?? []}
		/>

		{#if data.signed_up_events !== undefined}
			<SignedUpEventsDisplay signed_up_events={data.signed_up_events} />
		{/if}
		{#if data.strikes !== undefined}<StrikesDisplay strikes={data.strikes} />{/if}
	</main>
{:else if $currentUser}
	<main class="page tutee">
		<section class="tutee__intro">
			<h1>What are you working on, {firstName}?</h1>
			<div class="tutee__actions">
				<a class="btn btn-primary btn-lg" href="/tutoring">Request tutoring</a>
			</div>
		</section>

		{#if data?.hasContactInfo === false}
			<section class="tutee__contact" aria-labelledby="contact-title">
				<div>
					<h2 id="contact-title">Add your contact info</h2>
					<p>
						Your tutor sees it once they claim your request, so they can reach you to plan a time. A
						phone number, Instagram, or Discord works.
					</p>
				</div>
				<a class="btn btn-primary" href="/settings#about-you-title">Add contact info</a>
			</section>
		{/if}

		<section class="tutee__steps" aria-labelledby="steps-title">
			<h2 id="steps-title" class="section-title">How it goes</h2>
			<ol>
				<li>
					<h3>Share the class</h3>
					<p>Add the course, topic, teacher, and the times you're free.</p>
				</li>
				<li>
					<h3>Meet your tutor</h3>
					<p>A member claims your request. Use the session page to message and plan.</p>
				</li>
				<li>
					<h3>Wrap up the session</h3>
					<p>When you're done, confirm the time you spent together.</p>
				</li>
			</ol>
		</section>

		{#if data?.hasContactInfo}
			<p class="tutee__support">
				Changed your number or handle? Keep your contact info current in
				<a class="text-link" href="/settings#about-you-title">Settings</a>.
			</p>
		{/if}
		<p class="tutee__support">
			Something not working? Email Mekot, VP of Web Development, at
			<a class="text-link" href="mailto:stuyaristanycweb@gmail.com">stuyaristanycweb@gmail.com</a>.
		</p>
	</main>
{:else}
	<main class="home">
		<section class="hero" aria-labelledby="home-title">
			<picture>
				<source
					type="image/webp"
					srcset="/images/members-2026-640.webp 640w, /images/members-2026-1000.webp 1000w, /images/members-2026-1730.webp 1730w"
					sizes="100vw"
				/>
				<img
					class="hero__photo"
					src="/images/members-2026.jpg"
					srcset="/images/members-2026-1000.jpg 1000w, /images/members-2026.jpg 1730w"
					sizes="100vw"
					width="1730"
					height="763"
					alt="A large group of ARISTA members in ARISTA t-shirts, gathered together in a Stuyvesant hallway."
					fetchpriority="high"
				/>
			</picture>
			<div class="hero__shade" aria-hidden="true"></div>
			<p class="hero__credit">Photo by Jerry Qiu</p>
			<div class="hero__inner">
				<div class="hero__text">
					<h1 id="home-title">ARISTA</h1>
					<div class="hero__actions">
						<a class="btn btn-flame btn-lg" href="/tutoring">Request tutoring</a>
						<a class="btn btn-lg hero__ghost" href="/about">Meet ARISTA</a>
					</div>
				</div>
			</div>
		</section>

		<div class="home__body">
			<section class="ways" aria-labelledby="ways-title">
				<h2 id="ways-title" class="ways__title">How ARISTA can help</h2>
				<div class="ways__grid">
					{#each waysIn as way, index}
						<a class="way" href={way.href}>
							<span class="way__icon" aria-hidden="true">
								<svg viewBox="0 0 24 24">
									{#if index === 0}
										<!-- A tutor and a student -->
										<circle cx="9" cy="7.5" r="3.5" />
										<path d="M2.5 20.5v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1" />
										<path d="M16 4.2a3.5 3.5 0 0 1 0 6.6M18.5 14.7a5 5 0 0 1 3 4.6v1.2" />
									{:else if index === 1}
										<!-- An open book -->
										<path
											d="M12 6.5C10.2 5 7.6 4.5 3 4.5v14c4.6 0 7.2.5 9 2 1.8-1.5 4.4-2 9-2v-14c-4.6 0-7.2.5-9 2Z"
										/>
										<path d="M12 6.5v14" />
									{:else}
										<!-- A hand holding a heart -->
										<path d="M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16" />
										<path
											d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"
										/>
										<path d="m2 15 6 6" />
										<path
											d="M19.5 8.5c.7-.7 1.5-1.6 1.5-2.7A2.73 2.73 0 0 0 16 4a2.78 2.78 0 0 0-5 1.8c0 1.2.8 2 1.5 2.8L16 12Z"
										/>
									{/if}
								</svg>
							</span>
							<h3>{way.title}</h3>
							<p>{way.body}</p>
							<span class="way__action"
								>{way.action}<svg viewBox="0 0 24 24" aria-hidden="true"
									><path d="M5 12h14M13 6l6 6-6 6" /></svg
								></span
							>
						</a>
					{/each}
				</div>
			</section>

			<section class="pillars" aria-labelledby="pillars-title">
				<div class="pillars__head">
					<h2 id="pillars-title">Core Pillars</h2>
				</div>
				<PillarsTemple />
			</section>

			<section class="join" aria-labelledby="join-title">
				<div>
					<h2 id="join-title">Thinking about joining?</h2>
					<p>
						Applications open later in the spring. Freshmen, sophomores, and juniors with a 92
						overall average or higher can apply. Make an account now so you're ready when they do.
					</p>
				</div>
				<div class="join__actions">
					<a class="btn btn-flame btn-lg" href="/register">Create an account</a>
					<a class="join__link" href="/faq">Read the FAQ</a>
				</div>
			</section>
		</div>
	</main>
{/if}

<PWAInstall />

<style>
	/* ---------- Public home ---------- */
	.home {
		padding-bottom: clamp(3rem, 7vw, 6rem);
	}
	.home__body {
		width: min(var(--tool-width), 100% - 2 * var(--gutter));
		margin: 0 auto;
	}

	/* Full-bleed photo hero. The photo settles in and the headline rises:
	 * the page's one orchestrated motion moment. */
	.hero {
		position: relative;
		display: flex;
		align-items: flex-end;
		min-height: clamp(34rem, calc(100svh - 4.25rem), 60rem);
		overflow: hidden;
		background: #161616;
		color: #fff;
	}
	.hero__photo {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 35%;
		animation: settle 1400ms var(--ease-out) both;
	}
	.hero__shade {
		position: absolute;
		inset: 0;
		/* Neutral shade only behind the text, so the photo keeps its real colors. */
		background:
			linear-gradient(to top, rgb(0 0 0 / 78%) 0%, rgb(0 0 0 / 45%) 30%, rgb(0 0 0 / 0%) 62%),
			linear-gradient(to bottom, rgb(0 0 0 / 28%), rgb(0 0 0 / 0%) 18%);
	}
	.hero__credit {
		position: absolute;
		right: max(var(--gutter, 1rem), env(safe-area-inset-right));
		bottom: 0.75rem;
		z-index: 2;
		margin: 0;
		color: rgb(255 255 255 / 78%);
		font-size: var(--text-xs);
		text-shadow: 0 1px 2px rgb(0 0 0 / 60%);
	}
	.hero__inner {
		position: relative;
		width: min(var(--tool-width), 100% - 2 * var(--gutter));
		margin: 0 auto;
		padding: clamp(6rem, 14vh, 10rem) 0 clamp(2.5rem, 7vh, 4.5rem);
	}
	.hero__text {
		max-width: 46rem;
	}
	.hero h1 {
		color: #fff;
		font-size: clamp(4.5rem, 14vw, 10rem);
		letter-spacing: 0.02em;
		font-variation-settings:
			"SOFT" 100,
			"WONK" 1;
		font-weight: 560;
		letter-spacing: -0.025em;
		line-height: 0.98;
		text-shadow: 0 2px 24px rgb(0 0 0 / 25%);
		animation: rise 800ms var(--ease-out) 200ms both;
	}
	.hero__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-top: 1.75rem;
		animation: rise 800ms var(--ease-out) 420ms both;
	}
	.hero__ghost {
		border-color: rgb(255 255 255 / 55%);
		background: rgb(255 255 255 / 8%);
		color: #fff;
		backdrop-filter: blur(6px);
	}
	.hero__ghost:hover {
		border-color: #fff;
		background: rgb(255 255 255 / 16%);
		color: #fff;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(16px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@keyframes settle {
		from {
			opacity: 0;
			transform: scale(1.06);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.hero h1,
		.hero__actions,
		.hero__photo {
			animation: none;
		}
	}

	.ways {
		margin-top: clamp(3.5rem, 8vw, 6rem);
	}
	.ways__title {
		margin-bottom: clamp(1.25rem, 3vw, 2rem);
		font-size: clamp(2rem, 4vw, var(--text-3xl));
		font-variation-settings:
			"SOFT" 100,
			"WONK" 1;
		font-weight: 560;
	}
	.ways__grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
	}
	.way {
		display: grid;
		grid-template-rows: auto auto 1fr auto;
		gap: 0.75rem;
		padding: clamp(1.4rem, 2.5vw, 2rem);
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		background: var(--surface);
		color: var(--ink);
		text-decoration: none;
		transition:
			border-color var(--dur-3) var(--ease-out),
			background-color var(--dur-3) var(--ease-out),
			transform var(--dur-3) var(--ease-out);
	}
	.way:hover {
		border-color: var(--line-strong);
		background: var(--wash);
		transform: translateY(-2px);
	}
	.way__icon {
		display: grid;
		place-items: center;
		width: 3.5rem;
		height: 3.5rem;
		border-radius: 50%;
		background: var(--flame-soft);
		color: var(--flame-text);
	}
	.way__icon svg {
		width: 1.85rem;
		height: 1.85rem;
		fill: none;
		stroke: currentcolor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.6;
	}
	.way__action svg {
		width: 1.35rem;
		height: 1.35rem;
		fill: none;
		stroke: currentcolor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.75;
	}
	.way h3 {
		margin-top: 0.4rem;
		font-size: clamp(1.4rem, 2.2vw, 1.75rem);
		font-variation-settings: "SOFT" 100;
		font-weight: 560;
	}
	.way p {
		margin: 0;
		color: var(--muted);
		line-height: 1.6;
	}
	.way__action {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.5rem;
		color: var(--link);
		font-weight: 600;
	}
	.way__action svg {
		width: 1.1rem;
		height: 1.1rem;
		transition: transform var(--dur-3) var(--ease-out);
	}
	.way:hover .way__action svg {
		transform: translateX(3px);
	}
	@media (prefers-reduced-motion: reduce) {
		.way:hover {
			transform: none;
		}
	}

	.pillars {
		margin-top: clamp(4rem, 9vw, 7rem);
	}
	.pillars__head {
		margin: 0 0 clamp(1.5rem, 4vw, 2.5rem);
	}
	.pillars__head h2 {
		font-size: clamp(2rem, 4vw, var(--text-3xl));
		font-variation-settings:
			"SOFT" 100,
			"WONK" 1;
		font-weight: 560;
	}

	.join {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 1.5rem 3rem;
		align-items: center;
		margin-top: clamp(3.5rem, 8vw, 6.5rem);
		padding: clamp(1.75rem, 4.5vw, 3.5rem);
		border-radius: clamp(18px, 2.5vw, 32px);
		background: var(--seal);
		color: #fff;
	}
	:global(.dark) .join {
		background: var(--seal-soft);
	}
	.join h2 {
		color: #fff;
		font-size: clamp(1.75rem, 3.5vw, var(--text-3xl));
		font-variation-settings:
			"SOFT" 100,
			"WONK" 1;
		font-weight: 550;
	}
	.join p {
		max-width: 40rem;
		margin: 0.75rem 0 0;
		color: rgb(255 255 255 / 82%);
		font-size: var(--text-md);
		line-height: 1.55;
	}
	.join__actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1.25rem;
	}
	.join__link {
		color: #fff;
		font-weight: 600;
		text-decoration: underline;
		text-decoration-color: rgb(255 255 255 / 45%);
		text-underline-offset: 0.2em;
	}
	.join__link:hover {
		text-decoration-color: #fff;
	}

	/* ---------- Member dashboard ---------- */
	.dashboard {
		display: grid;
		gap: clamp(1.25rem, 3vw, 2rem);
	}
	.dashboard .page-header {
		margin-bottom: 0.5rem;
	}

	/* ---------- Tutee home ---------- */
	.tutee {
		display: grid;
		gap: clamp(2.5rem, 6vw, 4rem);
	}
	.tutee__intro h1 {
		max-width: 16ch;
		font-size: clamp(2.25rem, 5vw, var(--text-4xl));
		font-variation-settings:
			"SOFT" 100,
			"WONK" 1;
		font-weight: 560;
		line-height: 1.02;
	}
	.tutee__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-top: 1.75rem;
	}
	/* Timeline: across on wide screens, down the left edge on phones. */
	.tutee__steps ol {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 2rem;
		margin: 1.5rem 0 0;
		padding: 0;
		list-style: none;
		counter-reset: step;
	}
	.tutee__steps li {
		position: relative;
		counter-increment: step;
		text-align: center;
	}
	.tutee__steps li::before {
		position: relative;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		margin: 0 auto 1rem;
		border: 2px solid var(--flame);
		border-radius: 50%;
		background: var(--paper);
		color: var(--ink);
		content: counter(step);
		font-family: var(--font-display);
		font-weight: 600;
	}
	/* The connecting line runs from each dot to the next one. */
	.tutee__steps li:not(:last-child)::after {
		position: absolute;
		top: calc(1.125rem - 1px);
		left: calc(50% + 1.125rem);
		width: calc(100% + 2rem - 2.25rem);
		height: 2px;
		background: var(--line-strong);
		content: "";
	}
	.tutee__steps h3 {
		font-size: var(--text-lg);
	}
	.tutee__steps p {
		max-width: 30ch;
		margin: 0.35rem auto 0;
		color: var(--muted);
		line-height: 1.55;
	}
	.tutee__contact {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem 1.5rem;
		padding: 1.25rem 1.4rem;
		border: 1px solid color-mix(in srgb, var(--flame) 45%, transparent);
		border-radius: var(--radius-panel);
		background: color-mix(in srgb, var(--flame) 12%, var(--surface));
	}
	:global(.dark) .tutee__contact {
		background: var(--surface);
	}
	.tutee__contact h2 {
		font-size: var(--text-lg);
	}
	.tutee__contact p {
		max-width: 46ch;
		margin: 0.3rem 0 0;
		color: var(--muted);
		font-size: var(--text-sm);
	}
	.tutee__support {
		margin: 0;
		color: var(--muted);
		font-size: var(--text-sm);
	}

	@media (max-width: 860px) {
		.ways__grid {
			grid-template-columns: 1fr;
		}
		.join {
			grid-template-columns: 1fr;
		}
		.tutee__steps ol {
			grid-template-columns: 1fr;
			gap: 0;
		}
		.tutee__steps li {
			padding: 0 0 1.75rem 3.25rem;
			text-align: left;
		}
		.tutee__steps p {
			margin-left: 0;
		}
		.tutee__steps li:last-child {
			padding-bottom: 0;
		}
		.tutee__steps li::before {
			position: absolute;
			top: 0;
			left: 0;
			margin: 0;
		}
		.tutee__steps li:not(:last-child)::after {
			top: 2.25rem;
			left: calc(1.125rem - 1px);
			width: 2px;
			height: calc(100% - 2.25rem);
		}
		.tutee__steps h3 {
			padding-top: 0.3rem;
		}
	}
	@media (max-width: 560px) {
		.hero__photo {
			object-position: 40% 30%;
		}
	}
</style>
