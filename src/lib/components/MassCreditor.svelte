<script lang="ts">
	import { untrack } from "svelte";
	import { formFieldProxy, type FormFieldProxy, type SuperForm } from "sveltekit-superforms";
	interface Props {
		form: SuperForm<
			{
				csv_string: string;
			},
			any
		>;
	}

	let { form }: Props = $props();

	const { delayed, enhance } = untrack(() => form);

	const { value } = formFieldProxy(
		untrack(() => form),
		"csv_string"
	) satisfies FormFieldProxy<string>;
</script>

<section class="mass panel" aria-labelledby="mass-title">
	<div class="mass__intro">
		<h2 id="mass-title" class="section-title">Add credits in bulk</h2>
		<p>Paste one person per line, in this order:</p>
		<code class="mass__format">email,credits,type,note</code>
		<p>
			Type is <code>event</code>, <code>tutoring</code>, or <code>other</code>. Use
			<code>other-event</code> or <code>other-tutoring</code> to fill the Other credits someone still
			needs, then put the rest in events or tutoring. Lines that can't be read stay in the box so you
			can fix them.
		</p>
	</div>
	<form method="POST" action="?/mass_credit" use:enhance>
		<label class="sr-only" for="mass_credit_csv_string">Credit entries, one per line</label>
		<textarea
			name="csv_string"
			id="mass_credit_csv_string"
			autocomplete="off"
			spellcheck="false"
			placeholder="student@stuy.edu,2,event,Fall cleanup"
			bind:value={$value}></textarea>
		<div class="mass__footer">
			<span class="muted">
				{$value.trim() ? $value.trim().split("\n").length : 0} line{$value.trim().split("\n")
					.length === 1 && $value.trim()
					? ""
					: "s"}
			</span>
			<button type="submit" class="btn btn-primary" disabled={$delayed || !$value.trim()}>
				{$delayed ? "Adding credits…" : "Add credits"}
			</button>
		</div>
	</form>
</section>

<style>
	.mass {
		display: grid;
		grid-template-columns: minmax(0, 4fr) minmax(0, 7fr);
		gap: 1.5rem 2.5rem;
		margin-top: clamp(2.5rem, 6vw, 4rem);
	}
	.mass__intro p {
		margin: 0.5rem 0 0;
		color: var(--muted);
		font-size: var(--text-sm);
		line-height: 1.55;
	}
	code {
		padding: 0.05rem 0.35rem;
		border-radius: 6px;
		background: var(--surface-sunken);
		font-size: 0.85em;
	}
	.mass__format {
		display: inline-block;
		margin-top: 0.5rem;
		padding: 0.4rem 0.65rem;
	}
	textarea {
		min-height: 14rem !important;
		font-family: ui-monospace, "SF Mono", Menlo, monospace !important;
		font-size: 0.875rem !important;
	}
	.mass__footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 0.75rem;
		font-size: var(--text-sm);
	}
	@media (max-width: 860px) {
		.mass {
			grid-template-columns: 1fr;
		}
	}
</style>
