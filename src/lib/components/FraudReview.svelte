<script lang="ts">
	import { confirmDialog } from "$lib/skeleton-compat";
	import { enhance } from "$app/forms";
	import { page } from "$app/state";
	import { format } from "date-fns";
	import { roundCredits } from "$lib/calculateCredits";

	interface Props {
		session: {
			id: string;
			fraud?: boolean;
			fraudReason?: string;
			fraudAt?: string;
			fraudCreditsRemoved?: number;
			durationWarning?: boolean;
		};
		fraudByName: string;
		tutorName: string;
		/** Only admins get the Mark fraudulent control. */
		canMark: boolean;
	}
	let { session, fraudByName, tutorName, canMark }: Props = $props();
	const result = $derived((page.form ?? {}) as { fraudError?: string; fraudId?: string });
	const removed = $derived(roundCredits(session.fraudCreditsRemoved ?? 0));
</script>

{#if session.fraud}
	<div class="fraud fraud--marked" role="note">
		<!-- Who marked it and what was removed are admin-only (the server hides them from everyone else). -->
		<strong>
			Marked fraudulent{canMark && fraudByName ? ` by ${fraudByName}` : ""}{canMark &&
			session.fraudAt
				? ` on ${format(new Date(session.fraudAt), "MMM d, yyyy")}`
				: ""}
		</strong>
		{#if canMark}
			{#if session.fraudReason}<p>{session.fraudReason}</p>{/if}
			<p class="fraud__credits">
				{removed > 0
					? `${removed} tutoring credit${removed === 1 ? "" : "s"} removed from ${tutorName}.`
					: "No credits had been given for this session."}
			</p>
			<form
				method="POST"
				action="?/undo_fraud"
				class="fraud__undo"
				use:enhance={async ({ cancel }) => {
					const ok = await confirmDialog({
						title: "Undo fraud mark?",
						body:
							removed > 0
								? `${tutorName} gets ${removed} tutoring credit${removed === 1 ? "" : "s"} back.`
								: "The session goes back to flagged.",
						confirmLabel: "Undo fraud mark"
					});
					if (!ok) cancel();
				}}
			>
				<input type="hidden" name="id" value={session.id} />
				<button type="submit" class="btn btn-sm">Undo fraud mark</button>
				{#if result.fraudId === session.id && result.fraudError}
					<span class="field-error">{result.fraudError}</span>
				{/if}
			</form>
		{/if}
	</div>
{:else if canMark && session.durationWarning}
	<form
		method="POST"
		action="?/mark_fraud"
		class="fraud fraud__mark"
		use:enhance={async ({ cancel }) => {
			const ok = await confirmDialog({
				title: "Mark fraudulent?",
				body: `${tutorName} loses any tutoring credits from this session.`,
				confirmLabel: "Mark fraudulent",
				danger: true
			});
			if (!ok) cancel();
		}}
	>
		<input type="hidden" name="id" value={session.id} />
		<button type="submit" class="btn btn-sm btn-danger">Mark fraudulent</button>
		{#if result.fraudId === session.id && result.fraudError}
			<span class="field-error">{result.fraudError}</span>
		{/if}
	</form>
{/if}

<style>
	.fraud {
		margin-top: 0.75rem;
	}
	.fraud--marked {
		padding: 0.85rem 1rem;
		border-left: 4px solid var(--danger);
		border-radius: 10px;
		background: color-mix(in srgb, var(--danger) 10%, var(--surface));
	}
	.fraud--marked strong {
		color: var(--danger);
		font-size: var(--text-sm);
	}
	.fraud--marked p {
		margin: 0.3rem 0 0;
	}
	.fraud__undo {
		margin-top: 0.6rem;
	}
	.fraud__credits {
		color: var(--muted);
		font-size: var(--text-sm);
	}
	form {
		display: grid;
		gap: 0.5rem;
		max-width: 36rem;
		margin-top: 0.6rem;
	}
	form button {
		justify-self: start;
	}
</style>
