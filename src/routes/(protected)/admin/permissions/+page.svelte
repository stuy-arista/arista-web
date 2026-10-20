<script lang="ts">
	import { untrack } from "svelte";
	import { enhance } from "$app/forms";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import AdminSubnav from "$lib/components/AdminSubnav.svelte";
	import { ADMIN_SECTIONS, ADMIN_SECTION_INFO, isAdmin } from "$lib/adminAccess";
	import { officerName } from "$lib/displayName";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
	let query = $state(untrack(() => data.query));
	let timer: number | undefined;
	const result = $derived(
		(page.form ?? {}) as {
			permissionSaved?: string;
			permissionError?: string;
			permissionUser?: string;
		}
	);

	function search() {
		window.clearTimeout(timer);
		timer = window.setTimeout(() => {
			const params = new URLSearchParams();
			if (query.trim()) params.set("q", query.trim());
			void goto(`/admin/permissions?${params}`, {
				keepFocus: true,
				noScroll: true,
				replaceState: true
			});
		}, 300);
	}

	// Search finds anyone, including people who already have access, so their
	// permissions can be changed from here too.
	const searchResults = $derived(data.results);
</script>

<svelte:head><title>Permissions | ARISTA admin</title></svelte:head>

{#snippet personRow(person: (typeof data.granted)[number])}
	<li class="person">
		<div class="person__who">
			<strong>{officerName(person)}</strong>
			<span class="muted">{person.email}</span>
		</div>
		{#if isAdmin(person)}
			<p class="person__admin">
				<span class="badge badge--success">Admin</span> Full access to every section.
			</p>
		{:else}
			<form
				method="POST"
				action="?/set_sections"
				use:enhance={() =>
					async ({ update }) =>
						update({ reset: false })}
				class="person__form"
			>
				<input type="hidden" name="user" value={person.id} />
				<div class="person__sections" role="group" aria-label="Sections {person.name} can open">
					{#each ADMIN_SECTIONS as section}
						<label class="check" title={ADMIN_SECTION_INFO[section].description}>
							<input
								type="checkbox"
								name="sections"
								value={section}
								checked={person.adminSections?.includes(section)}
							/>
							<span>{ADMIN_SECTION_INFO[section].label}</span>
						</label>
					{/each}
				</div>
				<button type="submit" class="btn btn-sm btn-primary">Save</button>
				{#if result.permissionSaved === person.id}<span class="person__saved" role="status"
						>Saved.</span
					>{/if}
				{#if result.permissionUser === person.id && result.permissionError}
					<span class="field-error">{result.permissionError}</span>
				{/if}
			</form>
		{/if}
	</li>
{/snippet}

<main class="page page--tool">
	<header class="page-header"><div><h1>Admin</h1></div></header>
	<AdminSubnav />

	<section class="panel block" aria-labelledby="grant-title">
		<h2 id="grant-title" class="section-title">Give someone access</h2>
		<label class="search">
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
		{#if data.query.length >= 2 && searchResults.length === 0}
			<p class="muted">No one matches “{data.query}”.</p>
		{/if}
		{#if searchResults.length}
			<ul class="people">
				{#each searchResults as person (person.id)}{@render personRow(person)}{/each}
			</ul>
		{/if}
	</section>

	<section class="panel block" aria-labelledby="current-title">
		<h2 id="current-title" class="section-title">Who has access</h2>
		{#if data.granted.length}
			<ul class="people">
				{#each data.granted as person (person.id)}{@render personRow(person)}{/each}
			</ul>
		{:else}
			<p class="muted">Only admins right now.</p>
		{/if}
	</section>
</main>

<style>
	.block {
		display: grid;
		gap: 1rem;
	}
	.block + .block {
		margin-top: 1.25rem;
	}
	.search {
		position: relative;
		display: flex;
		align-items: center;
		max-width: 32rem;
	}
	.search svg {
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
	.search input {
		padding-left: 2.65rem !important;
		border-radius: var(--radius-pill) !important;
	}
	.people {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.person {
		display: grid;
		grid-template-columns: minmax(12rem, 1fr) minmax(0, 2.2fr);
		gap: 0.75rem 1.5rem;
		align-items: center;
		padding: 0.9rem 0;
		border-top: 1px solid var(--line);
	}
	.person__who {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}
	.person__who span {
		overflow: hidden;
		font-size: var(--text-sm);
		text-overflow: ellipsis;
	}
	.person__admin {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		color: var(--muted);
		font-size: var(--text-sm);
	}
	.person__form {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
	}
	.person__sections {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.check {
		position: relative;
		cursor: pointer;
	}
	.check input {
		position: absolute;
		width: 1px !important;
		height: 1px !important;
		opacity: 0;
	}
	.check span {
		display: inline-flex;
		align-items: center;
		min-height: 2.25rem;
		padding: 0.3rem 0.85rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-pill);
		color: var(--muted);
		font-size: var(--text-sm);
		font-weight: 600;
		transition:
			background-color var(--dur-2) var(--ease-out),
			color var(--dur-2) var(--ease-out);
	}
	.check input:checked + span {
		border-color: transparent;
		background: var(--ink);
		color: var(--paper);
	}
	.check input:focus-visible + span {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.person__saved {
		color: var(--success);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	@media (max-width: 760px) {
		.person {
			grid-template-columns: 1fr;
		}
	}
</style>
