<script lang="ts">
	import { untrack } from "svelte";
	import { enhance } from "$app/forms";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { superForm } from "sveltekit-superforms";
	import AdminSubnav from "$lib/components/AdminSubnav.svelte";
	import MassCreditor from "$lib/components/MassCreditor.svelte";
	import { officerName } from "$lib/displayName";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	const massCreditForm = superForm(
		untrack(() => data.mass_credit_form),
		{ resetForm: false }
	);
	let query = $state(untrack(() => data.query));
	let searchTimer: number | undefined;
	const result = $derived(
		(page.form ?? {}) as {
			credited?: string;
			creditedParts?: { type: string; credits: number }[];
			creditError?: string;
		}
	);

	function search() {
		window.clearTimeout(searchTimer);
		searchTimer = window.setTimeout(() => {
			const params = new URLSearchParams();
			if (query.trim()) params.set("q", query.trim());
			void goto(`/admin/crediting?${params}`, {
				keepFocus: true,
				noScroll: true,
				replaceState: true
			});
		}, 300);
	}
</script>

<svelte:head><title>Crediting | ARISTA admin</title></svelte:head>

<main class="page page--tool">
	<header class="page-header"><div><h1>Admin</h1></div></header>
	<AdminSubnav />

	<section class="panel single" aria-labelledby="single-title">
		<h2 id="single-title" class="section-title">Credit one person</h2>
		<label class="single__search">
			<span class="sr-only">Search by OSIS, name, or email</span>
			<svg viewBox="0 0 24 24" aria-hidden="true"
				><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.25 4.25" /></svg
			>
			<input
				type="search"
				bind:value={query}
				oninput={search}
				placeholder="Search by OSIS, name, or email"
				autocomplete="off"
			/>
		</label>

		{#if data.query.length >= 2 && data.results.length === 0}
			<p class="muted">No one matches “{data.query}”.</p>
		{/if}

		{#if data.results.length}
			<ul class="matches">
				{#each data.results as person (person.id)}
					<li>
						<div class="matches__who">
							<strong>{officerName(person)}</strong>
							<span class="muted"
								>{[person.email, person.osis ? `OSIS ${person.osis}` : "", person.graduationYear]
									.filter(Boolean)
									.join(" · ")}</span
							>
						</div>
						<form method="POST" action="?/credit_member" use:enhance class="matches__form">
							<input type="hidden" name="user" value={person.id} />
							<label>
								<span class="sr-only">Credits for {person.name}</span>
								<input
									name="credits"
									type="number"
									min="0.01"
									max="100"
									step="0.01"
									value="1"
									required
								/>
							</label>
							<label>
								<span class="sr-only">Credit type</span>
								<select name="type">
									<option value="event">Event</option>
									<option value="tutoring">Tutoring</option>
									<option value="other">Other</option>
									<option value="other_then_event">Other, then events</option>
									<option value="other_then_tutoring">Other, then tutoring</option>
								</select>
							</label>
							<label class="matches__reason">
								<span class="sr-only">Reason</span>
								<input name="manualExplanation" placeholder="Reason" required maxlength="256" />
							</label>
							<button type="submit" class="btn btn-primary btn-sm">Add credit</button>
						</form>
						{#if result.credited === person.id}
							<p class="matches__done" role="status">
								Added {(result.creditedParts ?? [])
									.map((part) => `${part.credits} ${part.type}`)
									.join(" and ")} credit{(result.creditedParts ?? []).reduce(
									(sum, part) => sum + part.credits,
									0
								) === 1
									? ""
									: "s"}.
							</p>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
		{#if result.creditError}<p class="field-error" role="alert">{result.creditError}</p>{/if}
	</section>

	<MassCreditor form={massCreditForm} />
</main>

<style>
	.single {
		display: grid;
		gap: 1rem;
	}
	.single__search {
		position: relative;
		display: flex;
		align-items: center;
		max-width: 32rem;
	}
	.single__search svg {
		position: absolute;
		left: 0.95rem;
		width: 1.1rem;
		height: 1.1rem;
		fill: none;
		stroke: var(--muted);
		stroke-linecap: round;
		stroke-width: 2;
		pointer-events: none;
	}
	.single__search input {
		padding-left: 2.65rem !important;
		border-radius: var(--radius-pill) !important;
	}
	.matches {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.matches li {
		display: grid;
		gap: 0.6rem;
		padding: 0.9rem 0;
		border-top: 1px solid var(--line);
	}
	.matches__who {
		display: grid;
		gap: 0.1rem;
	}
	.matches__who span {
		font-size: var(--text-sm);
	}
	.matches__form {
		display: grid;
		grid-template-columns: 6rem 9rem minmax(0, 1fr) auto;
		gap: 0.5rem;
		align-items: center;
	}
	.matches__form input,
	.matches__form select {
		min-height: 2.5rem !important;
	}
	.matches__done {
		margin: 0;
		color: var(--success);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	@media (max-width: 700px) {
		.matches__form {
			grid-template-columns: 1fr 1fr;
		}
		.matches__reason {
			grid-column: 1 / -1;
		}
	}
</style>
