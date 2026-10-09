<script lang="ts">
	import type {
		RecievedCredit,
		RecievedCreditSemester,
		RecievedPublicUserData
	} from "$lib/db_types";
	import { displayName, initials } from "$lib/displayName";
	import { roundCredits } from "$lib/calculateCredits";

	interface Props {
		data: {
			users: Pick<RecievedPublicUserData, "id" | "name" | "preferredName">[];
			allCredits: RecievedCredit[];
			creditSemesters: RecievedCreditSemester[];
		};
	}

	let { data }: Props = $props();
	let creditType: "event" | "tutoring" = $state("tutoring");

	type PeriodOption = { id: string; label: string; semesterIds: string[] };
	const periods = $derived.by(() => {
		const semesters = [...data.creditSemesters].sort((a, b) => a.key.localeCompare(b.key));
		const individual = semesters.map((semester) => ({
			id: semester.id,
			label: semester.name,
			semesterIds: [semester.id]
		}));
		const schoolYears = new Map<string, PeriodOption>();
		for (const semester of semesters) {
			const match = semester.key.match(/^(fall|spring)(\d{4})$/);
			if (!match) continue;
			const year = Number(match[2]) - (match[1] === "spring" ? 1 : 0);
			const id = `school-year-${year}`;
			const existing = schoolYears.get(id);
			if (existing) existing.semesterIds.push(semester.id);
			else
				schoolYears.set(id, {
					id,
					label: `${year}-${year + 1} school year`,
					semesterIds: [semester.id]
				});
		}
		return [...individual, ...schoolYears.values()].sort((a, b) => a.label.localeCompare(b.label));
	});

	let selectedPeriodId = $state("");
	$effect(() => {
		if (!periods.some((period) => period.id === selectedPeriodId)) {
			selectedPeriodId =
				data.creditSemesters.find((semester) => semester.active)?.id ?? periods[0]?.id ?? "";
		}
	});
	const selectedPeriod = $derived(periods.find((period) => period.id === selectedPeriodId));

	const creditTotalsByUser = $derived.by(() => {
		const semesterIds = selectedPeriod?.semesterIds ?? [];
		const totals = new Map<string, number>();
		for (const credit of data.allCredits) {
			if (credit.type !== creditType || !semesterIds.includes(credit.semester ?? "")) continue;
			totals.set(credit.user, roundCredits((totals.get(credit.user) ?? 0) + credit.credits));
		}
		return totals;
	});
	const leaderboard = $derived.by(() => {
		return data.users
			.map((user) => ({ name: displayName(user), value: creditTotalsByUser.get(user.id) ?? 0 }))
			.filter((entry) => entry.value > 0)
			.sort((a, b) => b.value - a.value)
			.map((entry, _, entries) => {
				const rank = entries.findIndex((other) => other.value === entry.value) + 1;
				return { ...entry, rank, label: `${rank}` };
			})
			.slice(0, 20);
	});

	const units = $derived(creditType === "tutoring" ? "tutoring credits" : "event credits");
	// Tied people share one podium step. Bigger ties fall back to the plain list.
	const podiumOrder = [2, 1, 3];
	const podiumGroups = $derived.by(() => {
		const groups = new Map<number, typeof leaderboard>();
		for (const entry of leaderboard) {
			if (entry.rank > 3) continue;
			groups.set(entry.rank, [...(groups.get(entry.rank) ?? []), entry]);
		}
		return [...groups.entries()]
			.map(([rank, entries]) => ({ rank, entries }))
			.sort((a, b) => podiumOrder.indexOf(a.rank) - podiumOrder.indexOf(b.rank));
	});
	const showPodium = $derived(
		podiumGroups.length > 0 && podiumGroups.every((group) => group.entries.length <= 2)
	);
	// Only places that exist get a column, so the podium stays centered as a group.
	const podiumColumns = $derived.by(() => {
		const hasShared = podiumGroups.some((group) => group.entries.length > 1);
		return podiumGroups
			.map((group) => {
				const weight = group.rank === 1 && hasShared ? 1.5 : 1;
				return `${Math.max(group.entries.length, weight)}fr`;
			})
			.join(" ");
	});
	const remainingEntries = $derived(
		showPodium ? leaderboard.filter((e) => e.rank > 3) : leaderboard
	);
</script>

<svelte:head><title>Leaderboard | ARISTA</title></svelte:head>

<main class="page leaderboard">
	<header class="page-header">
		<div>
			<h1>Leaderboard</h1>
		</div>
		<div class="leaderboard__controls">
			<div class="segmented" role="group" aria-label="Credit type">
				<button
					type="button"
					class:active={creditType === "tutoring"}
					aria-pressed={creditType === "tutoring"}
					onclick={() => (creditType = "tutoring")}>Tutoring</button
				>
				<button
					type="button"
					class:active={creditType === "event"}
					aria-pressed={creditType === "event"}
					onclick={() => (creditType = "event")}>Events</button
				>
			</div>
			<label>
				<span class="sr-only">Period</span>
				<select bind:value={selectedPeriodId}>
					{#each periods as period (period.id)}
						<option value={period.id}>{period.label}</option>
					{/each}
				</select>
			</label>
		</div>
	</header>

	{#key `${creditType}:${selectedPeriodId}`}
		{#if leaderboard.length === 0}
			<div class="empty-state">
				<h2>
					No {creditType === "tutoring" ? "tutoring" : "event"} credits yet for {selectedPeriod?.label ??
						"this period"}.
				</h2>
				<p>Rankings show up as soon as the first credits are recorded.</p>
			</div>
		{:else}
			{#if showPodium}
				<ol class="podium" aria-label="Top three" style:grid-template-columns={podiumColumns}>
					{#each podiumGroups as group, index (group.rank)}
						<li class="podium__place podium__place--{group.rank}" style:--order={index}>
							<div class="podium__people">
								{#each group.entries as entry (entry.name)}
									<div class="podium__person">
										<span class="podium__avatar" aria-hidden="true"
											>{initials({ name: entry.name })}</span
										>
										<strong>{entry.name}</strong>
										<span class="podium__value"><b>{entry.value}</b> {units}</span>
									</div>
								{/each}
							</div>
							<div class="podium__block" aria-hidden="true">
								<span>{group.entries[0].label}</span>
							</div>
							<span class="sr-only">Rank {group.entries[0].label}</span>
						</li>
					{/each}
				</ol>
			{/if}
			{#if remainingEntries.length}
				<ol class="rankings">
					{#each remainingEntries as entry}
						<li>
							<span class="rankings__rank">{entry.label}</span>
							<span class="rankings__name">{entry.name}</span>
							<span class="rankings__value"><b>{entry.value}</b> <small>{units}</small></span>
						</li>
					{/each}
				</ol>
			{/if}
		{/if}
	{/key}
</main>

<style>
	.leaderboard__controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
	}
	.segmented {
		display: inline-flex;
		padding: 0.25rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-pill);
		background: var(--surface-sunken);
	}
	.segmented button {
		min-height: 2.25rem;
		padding: 0.3rem 1rem;
		border: 0;
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: var(--text-sm);
		font-weight: 600;
		cursor: pointer;
		transition:
			background-color var(--dur-2) var(--ease-out),
			color var(--dur-2) var(--ease-out);
	}
	.segmented button.active {
		background: var(--surface);
		color: var(--ink);
		box-shadow:
			0 1px 2px rgb(22 39 90 / 12%),
			0 0 0 1px var(--line);
	}
	.leaderboard__controls select {
		width: auto !important;
		min-height: 2.75rem !important;
		border-radius: var(--radius-pill) !important;
		font-size: var(--text-sm) !important;
		font-weight: 600 !important;
	}

	/* A real podium: first place stands on the tallest block in the middle. */
	.podium {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		align-items: end;
		gap: 0;
		max-width: 46rem;
		margin: 1rem auto 0;
		padding: 0;
		list-style: none;
	}
	.podium__place {
		grid-row: 1;
		display: grid;
		min-width: 0;
		animation: podium-in 520ms var(--ease-out) both;
		animation-delay: calc(var(--order) * 90ms);
	}
	.podium__people {
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}
	.podium__person {
		flex: 1 1 0;
		min-width: 0;
		display: grid;
		justify-items: center;
		gap: 0.3rem;
		padding: 0 0.5rem 0.9rem;
		text-align: center;
	}
	.podium__avatar {
		display: grid;
		place-items: center;
		width: 3.25rem;
		height: 3.25rem;
		margin-bottom: 0.25rem;
		border-radius: 50%;
		background: var(--wash);
		color: var(--ink);
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 600;
		box-shadow:
			0 0 0 3px var(--paper),
			0 0 0 5px var(--line-strong);
	}
	.podium__place--1 .podium__avatar {
		width: 4rem;
		height: 4rem;
		background: var(--flame);
		color: #2a1a00;
		font-size: 1.35rem;
		box-shadow:
			0 0 0 3px var(--paper),
			0 0 0 5px var(--flame);
	}
	.podium__person strong {
		max-width: 100%;
		overflow: hidden;
		font-family: var(--font-display);
		font-size: clamp(1rem, 2vw, var(--text-lg));
		font-variation-settings: "SOFT" 100;
		font-weight: 600;
		line-height: 1.2;
		text-overflow: ellipsis;
		white-space: normal;
	}
	.podium__value {
		color: var(--muted);
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
	}
	.podium__value b {
		color: var(--ink);
		font-weight: 650;
	}
	.podium__block {
		display: grid;
		place-items: start center;
		padding-top: 0.9rem;
		border-radius: 14px 14px 0 0;
		background: var(--wash);
		color: var(--muted);
		font-family: var(--font-display);
		font-size: clamp(2rem, 5vw, 3rem);
		font-weight: 600;
		line-height: 1;
		box-shadow: inset 0 -6px 0 color-mix(in srgb, var(--ink) 6%, transparent);
	}
	.podium__place--1 .podium__block {
		height: 11rem;
		background: var(--seal);
		color: #fff;
	}
	.podium__place--2 .podium__block {
		height: 8rem;
		margin-right: 0.35rem;
	}
	.podium__place--3 .podium__block {
		height: 6rem;
		margin-left: 0.35rem;
	}
	:global(.dark) .podium__place--1 .podium__block {
		background: var(--seal-soft);
	}
	@keyframes podium-in {
		from {
			opacity: 0;
			transform: translateY(16px);
		}
	}

	.rankings {
		margin: 1.5rem 0 0;
		padding: 0;
		list-style: none;
	}
	.rankings li {
		display: grid;
		grid-template-columns: 2.25rem minmax(0, 1fr) auto;
		gap: 0.85rem;
		align-items: center;
		min-height: 3.5rem;
		border-bottom: 1px solid var(--line);
	}
	.rankings__rank {
		color: var(--muted);
		font-weight: 600;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.rankings__name {
		overflow: hidden;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.rankings__value {
		color: var(--muted);
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.rankings__value b {
		color: var(--ink);
		font-weight: 650;
	}
	.rankings__value small {
		font-size: var(--text-xs);
	}

	@media (max-width: 520px) {
		.podium__person strong {
			white-space: normal;
		}
		.podium__value {
			font-size: var(--text-xs);
		}
		.podium__place--1 .podium__block {
			height: 8rem;
		}
		.podium__place--2 .podium__block {
			height: 6rem;
		}
		.podium__place--3 .podium__block {
			height: 4.5rem;
		}
		.rankings__value small {
			display: none;
		}
	}
</style>
