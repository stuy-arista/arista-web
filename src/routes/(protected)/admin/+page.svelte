<script lang="ts">
	import calculateTotalStrikeWeight from "$lib/calculateTotalStrikeWeight";
	import AdminSubnav from "$lib/components/AdminSubnav.svelte";
	import type { RecievedUser } from "$lib/db_types";
	import type { PageData } from "./$types";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
	let users = $derived(data.users ?? []);
	let filters = $derived(
		data.filters ?? {
			search: "",
			membersOnly: false,
			insufficientOnly: false,
			bigSibOnly: false,
			graduationYears: [] as number[]
		}
	);
	let pagination = $derived(
		data.pagination ?? { page: 1, perPage: 25, totalItems: 0, totalPages: 0 }
	);
	let filterForm: HTMLFormElement;
	let filterTimer: number | undefined;
	let isFiltering = $state(false);

	// Seniors through freshmen for the current school year, plus last year's class.
	const schoolYearEnd =
		new Date().getMonth() >= 6 ? new Date().getFullYear() + 1 : new Date().getFullYear();
	const yearOptions = [-1, 0, 1, 2, 3].map((offset) => schoolYearEnd + offset);

	let sorting = $derived(data.sorting ?? { key: "", dir: "asc" });
	// Text columns sort A to Z first; number columns sort highest first.
	const sortColumns = [
		{ key: "name", label: "Name", numeric: false },
		{ key: "email", label: "Email", numeric: false },
		{ key: "type", label: "Type", numeric: false },
		{ key: "event", label: "Events", numeric: true },
		{ key: "tutoring", label: "Tutoring", numeric: true },
		{ key: "other", label: "Other", numeric: true },
		{ key: "strikes", label: "Strikes", numeric: true },
		{ key: "committees", label: "Committees", numeric: false },
		{ key: "homeroom", label: "Homeroom", numeric: false },
		{ key: "class", label: "Class", numeric: true },
		{ key: "osis", label: "OSIS", numeric: true }
	] as const;
	function nextSort(key: string, numeric: boolean) {
		if (sorting.key === key) return { key, dir: sorting.dir === "asc" ? "desc" : "asc" };
		return { key, dir: numeric ? "desc" : "asc" };
	}
	function sortHref(key: string, dir: string) {
		const params = new URL(page.url).searchParams;
		params.delete("page");
		if (key) {
			params.set("sort", key);
			params.set("dir", dir);
		} else {
			params.delete("sort");
			params.delete("dir");
		}
		return `/admin?${params}`;
	}

	function pageHref(page: number) {
		const params = new URLSearchParams();
		if (sorting.key) {
			params.set("sort", sorting.key);
			params.set("dir", sorting.dir);
		}
		if (filters.search) params.set("search", filters.search);
		if (filters.membersOnly) params.set("members", "true");
		if (filters.insufficientOnly) params.set("insufficient", "true");
		if (filters.bigSibOnly) params.set("bigsib", "true");
		for (const year of filters.graduationYears ?? []) params.append("year", String(year));
		if (pagination.perPage !== 25) params.set("limit", String(pagination.perPage));
		params.set("page", String(page));
		return `/admin?${params}`;
	}

	function exportHref() {
		const params = new URLSearchParams();
		if (filters.search) params.set("search", filters.search);
		if (filters.membersOnly) params.set("members", "true");
		if (filters.insufficientOnly) params.set("insufficient", "true");
		if (filters.bigSibOnly) params.set("bigsib", "true");
		for (const year of filters.graduationYears ?? []) params.append("year", String(year));
		return `/admin/export?${params}`;
	}

	function csvCell(value: unknown) {
		// A leading = + - @ makes spreadsheets run the cell as a formula.
		const text = String(value ?? "").replace(/^[=+\-@\t\r]/, "'$&");
		return `"${text.replaceAll('"', '""')}"`;
	}

	function exportCurrentPage() {
		const headers = [
			"Name",
			"Email",
			"Account type",
			"Event credits",
			"Tutoring credits",
			"Other credits",
			"Strike weight",
			"Committees",
			"Homeroom",
			"Graduation year",
			"OSIS"
		];
		const rows = users.map((user) => [
			user.name,
			user.email,
			user.member ? "Member" : "Tutee",
			user.semesterTotals?.event.have ?? 0,
			user.semesterTotals?.tutoring.have ?? 0,
			user.semesterTotals?.other.have ?? 0,
			calculateTotalStrikeWeight(user.strikes),
			user.committees.join(", ") || "none",
			user.homeroom,
			user.graduationYear,
			user.osis
		]);
		const blob = new Blob(
			[[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")],
			{ type: "text/csv;charset=utf-8" }
		);
		const link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = `arista-members-page-${pagination.page}.csv`;
		link.click();
		URL.revokeObjectURL(link.href);
	}

	async function refreshDirectory() {
		if (!filterForm) return;
		const params = new URLSearchParams();
		for (const [key, value] of new FormData(filterForm).entries()) {
			if (typeof value === "string" && value) params.append(key, value);
		}
		isFiltering = true;
		try {
			await goto(`/admin?${params.toString()}`, {
				keepFocus: true,
				noScroll: true,
				replaceState: true
			});
		} finally {
			isFiltering = false;
		}
	}

	function submitFilters() {
		if (filterTimer) window.clearTimeout(filterTimer);
		void refreshDirectory();
	}

	function queueSearchFilter() {
		if (filterTimer) window.clearTimeout(filterTimer);
		filterTimer = window.setTimeout(submitFilters, 350);
	}
</script>

<svelte:head><title>People | ARISTA admin</title></svelte:head>

{#snippet credit(user: (typeof users)[number], type: "event" | "tutoring" | "other")}
	{@const have = user.semesterTotals?.[type]?.have ?? 0}
	{#if user.member}
		{@const need = user.semesterTotals?.[type]?.required ?? 0}
		<span class="credit" class:credit--short={have < need}>{have}<span> / {need}</span></span>
	{:else}
		<span class="muted">–</span>
	{/if}
{/snippet}

<main class="page page--tool admin">
	<header class="page-header">
		<div>
			<h1>Admin</h1>
		</div>
	</header>
	<AdminSubnav />

	<form
		method="GET"
		bind:this={filterForm}
		class="filters"
		onsubmit={(event) => {
			event.preventDefault();
			submitFilters();
		}}
	>
		<label class="filters__search">
			<span class="sr-only">Search by name or email</span>
			<svg viewBox="0 0 24 24" aria-hidden="true"
				><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.25 4.25" /></svg
			>
			<input
				name="search"
				value={filters.search}
				type="search"
				placeholder="Search by name or email"
				oninput={queueSearchFilter}
			/>
		</label>
		<div class="filters__toggles" role="group" aria-label="Filters">
			<label class="toggle-chip">
				<input
					name="members"
					value="true"
					type="checkbox"
					checked={filters.membersOnly}
					onchange={submitFilters}
				/>
				<span>Members only</span>
			</label>
			<label class="toggle-chip">
				<input
					name="insufficient"
					value="true"
					type="checkbox"
					checked={filters.insufficientOnly}
					onchange={submitFilters}
				/>
				<span>Below requirements</span>
			</label>
			<label class="toggle-chip">
				<input
					name="bigsib"
					value="true"
					type="checkbox"
					checked={filters.bigSibOnly}
					onchange={submitFilters}
				/>
				<span>Big Sibs</span>
			</label>
			<details class="year-picker">
				<summary class="toggle-chip__look" class:is-on={filters.graduationYears?.length}>
					{filters.graduationYears?.length
						? [...filters.graduationYears].sort().join(", ")
						: "Graduation year"}
				</summary>
				<div class="year-picker__menu">
					{#each yearOptions as year}
						<label>
							<input
								type="checkbox"
								name="year"
								value={year}
								checked={filters.graduationYears?.includes(year)}
								onchange={submitFilters}
							/>
							{year}
						</label>
					{/each}
				</div>
			</details>
		</div>
		{#if sorting.key}
			<input type="hidden" name="sort" value={sorting.key} />
			<input type="hidden" name="dir" value={sorting.dir} />
		{/if}
		<label class="filters__limit filters__sort">
			<span>Sort by</span>
			<select
				value={sorting.key ? `${sorting.key}:${sorting.dir}` : ""}
				onchange={(event) => {
					const [key, dir] = event.currentTarget.value.split(":");
					goto(sortHref(key, dir ?? "asc"), { noScroll: true, keepFocus: true });
				}}
			>
				<option value="">Newest accounts</option>
				{#each sortColumns as column (column.key)}
					{#if column.numeric}
						<option value="{column.key}:desc">{column.label}, highest first</option>
						<option value="{column.key}:asc">{column.label}, lowest first</option>
					{:else}
						<option value="{column.key}:asc">{column.label}, A to Z</option>
						<option value="{column.key}:desc">{column.label}, Z to A</option>
					{/if}
				{/each}
			</select>
		</label>
		<label class="filters__limit">
			<span>Show</span>
			<select name="limit" value={String(pagination.perPage)} onchange={submitFilters}>
				<option value="25">25</option>
				<option value="50">50</option>
				<option value="100">100</option>
				<option value="150">150</option>
			</select>
		</label>
	</form>

	<section aria-labelledby="directory-results" class="results" class:is-refreshing={isFiltering}>
		<div class="results__bar">
			<p id="directory-results">
				<strong>{pagination.totalItems.toLocaleString()}</strong>
				{pagination.totalItems === 1 ? "account" : "accounts"}{#if pagination.totalPages > 1}<span
						class="muted">, page {pagination.page} of {pagination.totalPages}</span
					>{/if}
				{#if isFiltering}<span class="results__status" aria-live="polite">Updating…</span>{/if}
			</p>
			<div class="results__actions">
				<button
					type="button"
					class="btn btn-sm"
					onclick={exportCurrentPage}
					disabled={!users.length}>Export this page</button
				>
				<a class="btn btn-sm btn-primary" href={exportHref()}>Export all as CSV</a>
			</div>
		</div>

		{#if users.length === 0}
			<div class="empty-state">
				<h2>No one matches these filters.</h2>
				<p>Try a shorter search or turn off a filter.</p>
			</div>
		{:else}
			<ul class="people-cards">
				{#each users as user (user.id)}
					<li class="panel">
						<div class="people-cards__top">
							<div>
								<a class="people-cards__name" href={`/admin/view_user/${user.id}`}>{user.name}</a>
								{#if user.bigSib}<span class="badge big-sib-badge">Big Sib</span>{/if}
								<p>{user.email}</p>
								<p>{[user.homeroom, user.graduationYear].filter(Boolean).join(" · ")}</p>
							</div>
							<span class="badge" class:badge--success={user.member}
								>{user.member ? "Member" : "Tutee"}</span
							>
						</div>
						{#if user.member}
							<dl>
								<div>
									<dt>Events</dt>
									<dd>{@render credit(user, "event")}</dd>
								</div>
								<div>
									<dt>Tutoring</dt>
									<dd>{@render credit(user, "tutoring")}</dd>
								</div>
								<div>
									<dt>Other</dt>
									<dd>{@render credit(user, "other")}</dd>
								</div>
								<div>
									<dt>Strikes</dt>
									<dd>{calculateTotalStrikeWeight(user.strikes)}</dd>
								</div>
							</dl>
						{/if}
					</li>
				{/each}
			</ul>

			<div class="table-container people-table">
				<table class="table table-hover">
					<thead>
						<tr>
							{#each sortColumns as column (column.key)}
								{@const next = nextSort(column.key, column.numeric)}
								<th
									scope="col"
									class:num={column.numeric && column.key !== "class"}
									aria-sort={sorting.key === column.key
										? sorting.dir === "asc"
											? "ascending"
											: "descending"
										: undefined}
								>
									<a
										class="sort"
										class:is-active={sorting.key === column.key}
										href={sortHref(next.key, next.dir)}
										data-sveltekit-noscroll
										>{column.label}<span class="sort__arrow" aria-hidden="true"
											>{sorting.key === column.key
												? sorting.dir === "asc"
													? "↑"
													: "↓"
												: "↕"}</span
										></a
									>
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each users as user (user.id)}
							<tr>
								<td>
									<a class="people-table__name" href={`/admin/view_user/${user.id}`}>{user.name}</a>
									{#if user.bigSib}<span class="badge big-sib-badge">Big Sib</span>{/if}
								</td>
								<td class="muted">{user.email}</td>
								<td>{user.member ? "Member" : "Tutee"}</td>
								<td class="num">{@render credit(user, "event")}</td>
								<td class="num">{@render credit(user, "tutoring")}</td>
								<td class="num">{@render credit(user, "other")}</td>
								<td class="num"
									>{user.member ? calculateTotalStrikeWeight(user.strikes) || "–" : "–"}</td
								>
								<td class="muted">{user.committees.join(", ") || "–"}</td>
								<td>{user.homeroom}</td>
								<td class="num">{user.graduationYear}</td>
								<td class="num muted">{user.osis}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		{#if pagination.totalPages > 1}
			<nav class="pager" aria-label="Directory pages">
				<a
					class="btn btn-sm"
					href={pageHref(Math.max(1, pagination.page - 1))}
					aria-disabled={pagination.page <= 1}
					class:is-disabled={pagination.page <= 1}>Previous</a
				>
				<span>Page {pagination.page} of {pagination.totalPages}</span>
				<a
					class="btn btn-sm"
					href={pageHref(Math.min(pagination.totalPages, pagination.page + 1))}
					aria-disabled={pagination.page >= pagination.totalPages}
					class:is-disabled={pagination.page >= pagination.totalPages}>Next</a
				>
			</nav>
		{/if}
	</section>
</main>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}
	.filters__search {
		position: relative;
		display: flex;
		flex: 1 1 18rem;
		align-items: center;
	}
	.filters__search svg {
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
	.filters__search input {
		padding-left: 2.65rem !important;
		border-radius: var(--radius-pill) !important;
	}
	.filters__toggles {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.toggle-chip {
		position: relative;
		cursor: pointer;
	}
	.toggle-chip input {
		position: absolute;
		width: 1px !important;
		height: 1px !important;
		opacity: 0;
	}
	.toggle-chip span {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 2.5rem;
		padding: 0.35rem 0.9rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-pill);
		color: var(--muted);
		font-size: var(--text-sm);
		font-weight: 600;
		transition:
			background-color var(--dur-2) var(--ease-out),
			border-color var(--dur-2) var(--ease-out),
			color var(--dur-2) var(--ease-out);
	}
	.toggle-chip:hover span {
		color: var(--ink);
	}
	.toggle-chip input:checked + span {
		border-color: transparent;
		background: var(--ink);
		color: var(--paper);
	}
	.toggle-chip input:checked + span::before {
		width: 0.7rem;
		height: 0.4rem;
		margin-top: -0.15rem;
		border-bottom: 2px solid currentcolor;
		border-left: 2px solid currentcolor;
		content: "";
		transform: rotate(-45deg);
	}
	.toggle-chip input:focus-visible + span {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.year-picker {
		position: relative;
	}
	.toggle-chip__look {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 2.5rem;
		padding: 0.35rem 0.9rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-pill);
		color: var(--muted);
		font-size: var(--text-sm);
		font-weight: 600;
		list-style: none;
		cursor: pointer;
	}
	.toggle-chip__look::-webkit-details-marker {
		display: none;
	}
	.toggle-chip__look::after {
		width: 0.35rem;
		height: 0.35rem;
		margin-left: 0.2rem;
		border-right: 1.5px solid currentcolor;
		border-bottom: 1.5px solid currentcolor;
		content: "";
		transform: rotate(45deg) translateY(-2px);
	}
	.toggle-chip__look.is-on {
		border-color: transparent;
		background: var(--ink);
		color: var(--paper);
	}
	.year-picker__menu {
		position: absolute;
		z-index: 20;
		top: calc(100% + 0.4rem);
		left: 0;
		display: grid;
		gap: 0.15rem;
		min-width: 12rem;
		padding: 0.5rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-field);
		background: var(--surface);
		box-shadow: var(--shadow-float);
	}
	.year-picker__menu label {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-height: 2.5rem;
		padding: 0 0.6rem;
		border-radius: 8px;
		font-size: var(--text-sm);
		cursor: pointer;
	}
	.year-picker__menu label:hover {
		background: var(--wash);
	}
	.filters__limit {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--muted);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.filters__limit select {
		width: auto !important;
		min-height: 2.5rem !important;
		border-radius: var(--radius-pill) !important;
		font-size: var(--text-sm) !important;
	}

	.results {
		margin-top: 1.5rem;
		transition: opacity var(--dur-2) ease;
	}
	.results.is-refreshing > :not(.results__bar) {
		opacity: 0.55;
	}
	.results__bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.85rem;
	}
	.results__bar p {
		margin: 0;
	}
	.results__status {
		margin-left: 0.5rem;
		color: var(--flame-text);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.results__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.people-table__name,
	.people-cards__name {
		color: var(--ink);
		font-weight: 600;
		text-decoration: none;
	}
	.people-table__name:hover,
	.people-cards__name:hover {
		color: var(--link);
		text-decoration: underline;
	}
	.table .num {
		text-align: right;
		white-space: nowrap;
	}
	.credit {
		font-weight: 600;
	}
	.credit span {
		color: var(--muted);
		font-weight: 400;
	}
	.credit--short {
		color: var(--danger);
	}

	.sort {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: inherit;
		text-decoration: none;
		white-space: nowrap;
	}
	.sort:hover,
	.sort.is-active {
		color: var(--ink);
	}
	.sort__arrow {
		color: var(--muted);
		font-size: 0.8em;
		opacity: 0.55;
	}
	.sort.is-active .sort__arrow {
		color: var(--flame);
		opacity: 1;
	}
	.people-cards {
		display: none;
		gap: 0.75rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.people-cards li {
		display: grid;
		gap: 0.85rem;
	}
	.people-cards__top {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.people-cards__top p {
		margin: 0.1rem 0 0;
		color: var(--muted);
		font-size: var(--text-sm);
		overflow-wrap: anywhere;
	}
	.people-cards dl {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.5rem;
		margin: 0;
	}
	.people-cards dt {
		color: var(--muted);
		font-size: var(--text-xs);
	}
	.people-cards dd {
		margin: 0.1rem 0 0;
	}
	.people-cards .muted {
		margin: 0;
		font-size: var(--text-sm);
	}

	.pager {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 1rem;
		color: var(--muted);
		font-size: var(--text-sm);
	}
	.pager .is-disabled {
		opacity: 0.4;
		pointer-events: none;
	}

	@media (max-width: 1024px) {
		.people-table {
			display: none;
		}
		.people-cards {
			display: grid;
		}
	}
	@media (max-width: 420px) {
		.people-cards dl {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	.big-sib-badge {
		margin-left: 0.4rem;
		vertical-align: middle;
		font-size: var(--text-xs);
	}
</style>
