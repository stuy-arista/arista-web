<script lang="ts">
	import PhotoSlideshow, { type Slide } from "$lib/components/PhotoSlideshow.svelte";

	// Event photos for the slideshow. Drop more into static/images/events/ and
	// add them here; captions are optional.
	const slides: Slide[] = [
		{
			src: "/images/open-house-2026-2400.jpg",
			alt: "ARISTA members in ARISTA t-shirts, filling a Stuyvesant hallway for the Fall 2026 Open House.",
			caption: "Fall 2026 Open House. Photo by Anders Zernike",
			position: "50% 45%"
		},
		{
			src: "/images/members-2026.jpg",
			alt: "A large group of ARISTA members in ARISTA t-shirts, gathered together in a Stuyvesant hallway.",
			caption: "ARISTA members, 2026. Photo by Jerry Qiu",
			position: "50% 35%"
		},
		{
			src: "/images/events/mckinley-park-cleanup.jpg",
			alt: "Three ARISTA volunteers raking leaves along a path in McKinley Park.",
			caption: "McKinley Park cleanup",
			position: "50% 45%"
		},
		{
			src: "/images/events/walk-in-the-park.jpg",
			alt: "Four ARISTA volunteers in event t-shirts smiling behind a table of muffins and water at the Walk in the Park.",
			caption: "Alzheimer's Foundation Walk in the Park",
			position: "50% 40%"
		}
	];

	const board = [
		{ name: "Aidan Zeleniy", role: "President" },
		{ name: "Eric Lam", role: "Vice President of Events & Service" },
		{ name: "Emma Musyuk", role: "Vice President of Operations" },
		{ name: "Mekot Sarder", role: "Vice President of Web Development" },
		{ name: "Krish Kalantry", role: "Head of Tutoring" }
	];
</script>

<svelte:head>
	<title>About ARISTA | Stuyvesant High School</title>
</svelte:head>

<main class="about">
	<div class="about__top page">
		<header class="about__intro">
			<h1>About ARISTA</h1>
			<p class="lead">
				ARISTA is Stuyvesant High School’s premier honor society. We strive to become positive role
				models as we proudly serve our communities by upholding our four pillars of character,
				leadership, scholarship, and service. Not only are our handpicked members—some of the most
				diligent and morally upright students within Stuyvesant—the backbone of the academic support
				system within Stuyvesant, but we are also a coveted volunteer force that positively
				permeates the greater New York City community.
			</p>
			<p class="lead">
				Despite the sometimes overwhelming amount of obligations and commitments our members have,
				we, high school students, are perhaps one of the most reliable volunteer groups in the
				country—not because we have more time than anyone else, but because we make time for the
				causes we care about.
			</p>
		</header>

		<div class="about__photos">
			<PhotoSlideshow {slides} label="Photos from ARISTA events" />
		</div>
	</div>

	<section class="board page" aria-labelledby="board-title">
		<div class="board__heading">
			<h2 id="board-title">The 2026–27 executive council</h2>
		</div>
		<div class="board__content">
			<figure class="board__photo">
				<img
					src="/images/board-2026.jpg"
					width="2000"
					height="1333"
					alt="The five members of ARISTA's 2026–27 executive council, standing together in the Stuyvesant lobby."
					loading="lazy"
				/>
				<figcaption>
					<span>From left: Eric Lam, Emma Musyuk, Aidan Zeleniy, Mekot Sarder, Krish Kalantry</span>
					<span class="board__credit">Photo by Anders Zernike</span>
				</figcaption>
			</figure>
			<ul>
				{#each board as person}
					<li>
						<strong>{person.name}</strong>
						<span>{person.role}</span>
					</li>
				{/each}
			</ul>
		</div>
	</section>

	<section class="report page" aria-labelledby="report-title">
		<div>
			<h2 id="report-title">The 2024–25 annual report</h2>
			<p>A look back at a year of tutoring, service, and the students behind the numbers.</p>
		</div>
		<div class="report__actions">
			<a class="btn btn-primary" href="/annual-report">Read the report</a>
			<a class="btn" href="/ARISTA-report-24-25.pdf" download>Download PDF</a>
		</div>
	</section>

	<section class="contact page" aria-labelledby="contact-title">
		<h2 id="contact-title">Say hello.</h2>
		<p>
			Questions about tutoring, membership, or partnering with ARISTA? Email
			<a class="text-link" href="mailto:stuyaristanyc@gmail.com">stuyaristanyc@gmail.com</a>.
		</p>
	</section>
</main>

<style>
	.about {
		padding-bottom: clamp(3rem, 7vw, 5rem);
	}
	.about .page {
		width: min(var(--tool-width), 100% - 2 * var(--gutter));
		padding: 0;
	}

	.about__top {
		display: grid;
		grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
		gap: 2rem clamp(2rem, 5vw, 4rem);
		align-items: center;
		padding-top: clamp(2.5rem, 6vw, 4.5rem) !important;
	}
	.about__intro {
		display: grid;
		gap: 1.25rem;
	}
	.board__photo {
		margin: 0;
	}
	.board__photo figcaption {
		display: grid;
		gap: 0.15rem;
		margin-top: 0.6rem;
		color: var(--muted);
		font-size: var(--text-sm);
	}
	.board__credit {
		color: var(--muted);
		font-size: var(--text-xs);
	}
	.about__intro .lead {
		margin: 0;
	}

	.about__intro h1 {
		max-width: 13ch;
		font-size: clamp(2.75rem, 6.5vw, var(--text-5xl));
		font-variation-settings:
			"SOFT" 100,
			"WONK" 1;
		font-weight: 560;
		letter-spacing: -0.025em;
		line-height: 0.98;
	}

	section.page {
		margin-top: clamp(3.5rem, 8vw, 6rem);
	}
	section h2 {
		font-size: clamp(1.75rem, 3vw, var(--text-2xl));
	}

	.board__content {
		display: grid;
		grid-template-columns: minmax(0, 7fr) minmax(16rem, 4fr);
		gap: clamp(1.5rem, 4vw, 3.5rem);
		align-items: center;
		margin-top: 1.75rem;
	}
	.board__content img {
		width: 100%;
		height: auto;
		aspect-ratio: 3 / 2;
		border-radius: var(--radius-photo);
		object-fit: cover;
		background: var(--wash);
	}
	.board ul {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.board li {
		display: grid;
		gap: 0.15rem;
		padding: 1rem 0;
		border-bottom: 1px solid var(--line);
	}
	.board li:first-child {
		border-top: 1px solid var(--line);
	}
	.board strong {
		font-family: var(--font-display);
		font-size: var(--text-lg);
		font-variation-settings: "SOFT" 100;
		font-weight: 600;
	}
	.board li span {
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.report {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1.25rem 2rem;
		padding: clamp(1.5rem, 4vw, 2.5rem) !important;
		border-radius: var(--radius-panel);
		background: var(--wash);
	}
	.report p {
		margin: 0.5rem 0 0;
		color: var(--muted);
	}
	.report__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.contact p {
		max-width: 40rem;
		margin: 0.6rem 0 0;
		color: var(--muted);
		font-size: var(--text-md);
	}

	@media (max-width: 860px) {
		.about__top,
		.board__content {
			grid-template-columns: 1fr;
		}
		/* On narrow screens the photos lead, so they aren't buried under the text. */
		.about__photos {
			order: -1;
		}
	}
</style>
