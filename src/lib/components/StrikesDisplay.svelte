<script lang="ts">
	import { confirmDialog } from "$lib/skeleton-compat";
	import calculateTotalStrikeWeight from "$lib/calculateTotalStrikeWeight";
	import type { RecievedStrike } from "$lib/db_types";
	import { enhance } from "$app/forms";
	interface Props {
		strikes: RecievedStrike[];
		/** Admin view: show a Remove button on each strike. */
		canRemove?: boolean;
	}
	let { strikes, canRemove = false }: Props = $props();
	let total = $derived(
		Math.round((calculateTotalStrikeWeight(strikes) + Number.EPSILON) * 100) / 100
	);
</script>

{#if strikes.length > 0}
	<section class="strikes panel" aria-labelledby="strikes-title">
		<header class="strikes__head">
			<div>
				<h2 id="strikes-title" class="section-title">
					{canRemove ? "Strikes" : "Strikes on your record"}
				</h2>
				{#if !canRemove}<p>If something here looks wrong, talk to an officer.</p>{/if}
			</div>
			<span class="badge badge--warning">{total} total</span>
		</header>
		<ul>
			{#each strikes as strike (strike.id)}
				<li>
					<span class="strikes__weight">{strike.weight}</span>
					<p>{strike.reason}</p>
					{#if canRemove}
						<form
							method="POST"
							action="?/delete_strike"
							use:enhance={async ({ cancel }) => {
								const ok = await confirmDialog({
									title: "Remove strike?",
									body: `"${strike.reason}" comes off this member's record. This can't be undone.`,
									confirmLabel: "Remove strike",
									danger: true
								});
								if (!ok) cancel();
							}}
						>
							<input type="hidden" name="strikeId" value={strike.id} />
							<button type="submit" class="strikes__remove">Remove</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{:else}
	<section class="strikes strikes--clear panel" aria-labelledby="strikes-title">
		<h2 id="strikes-title" class="section-title">Strikes</h2>
		<p>{canRemove ? "No strikes." : "No strikes on your record."}</p>
	</section>
{/if}

<style>
	.strikes__remove {
		min-height: 0;
		padding: 0.25rem 0.6rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: var(--text-xs);
		font-weight: 600;
		cursor: pointer;
	}
	.strikes__remove:hover,
	.strikes__remove:focus-visible {
		border-color: var(--danger, #c0392b);
		color: var(--danger, #c0392b);
	}
	.strikes {
		border-color: color-mix(in srgb, var(--flame) 45%, var(--line));
	}
	.strikes--clear {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		border-color: var(--line);
	}
	.strikes--clear p {
		margin: 0;
		color: var(--muted);
		font-size: var(--text-sm);
	}
	.strikes__head {
		display: flex;
		flex-wrap: wrap;
		align-items: start;
		justify-content: space-between;
		gap: 0.75rem 1rem;
	}
	.strikes__head p {
		margin: 0.35rem 0 0;
		color: var(--muted);
		font-size: var(--text-sm);
	}
	ul {
		display: grid;
		margin: 1rem 0 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		grid-template-columns: 2.5rem minmax(0, 1fr) auto;
		gap: 0.75rem;
		align-items: baseline;
		padding: 0.65rem 0;
		border-top: 1px solid var(--line);
	}
	.strikes__weight {
		color: var(--flame-text);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	li p {
		margin: 0;
		line-height: 1.5;
	}
</style>
