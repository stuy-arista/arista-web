<script lang="ts">
	import { untrack } from "svelte";
	import type { PageData } from "./$types";
	import { page } from "$app/state";
	import { enhance } from "$app/forms";
	import { superForm, formFieldProxy } from "sveltekit-superforms";
	import InputField from "$lib/components/InputField.svelte";
	import StrikesDisplay from "$lib/components/StrikesDisplay.svelte";
	import SemesterCreditPanel from "$lib/components/SemesterCreditPanel.svelte";

	let user_id = page.params.id;
	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
	const strikeFormObj = superForm(untrack(() => data.strikeForm));
	const creditFormObj = superForm(untrack(() => data.creditForm));

	const creditFormType = formFieldProxy(creditFormObj, "type").value;

	let full_user = $derived(data.user);
	const fraudCount = $derived(
		data.tutoringSessions?.filter((session) => session.fraud).length ?? 0
	);
	// Saved focus, kept locally so the switch doesn't reload page data (which
	// would wipe anything typed into Add credit).
	let savedFocus = $state<{ id: string; value: boolean } | null>(null);
	const creditChoice = $derived(
		savedFocus?.id === full_user?.id ? savedFocus.value : Boolean(full_user?.creditChoice)
	);
	const creditedParts = $derived(
		(page.form as { creditedParts?: { type: string; credits: number }[] } | null)?.creditedParts
	);
	const choiceResult = $derived(
		(page.form ?? {}) as { choiceUpdated?: boolean; choiceError?: string }
	);
</script>

<svelte:head><title>{full_user?.name ?? "Account"} | ARISTA admin</title></svelte:head>

<main class="page page--tool view-user">
	<a class="back" href={data.canManage ? "/admin" : "/admin/tutoring"}>
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
		{data.canManage ? "People" : "Tutoring review"}
	</a>
	{#if full_user}
		<header class="page-header">
			<div>
				<h1>{full_user.name}</h1>
				<p class="view-user__meta">
					{#if full_user.email}<a class="text-link" href="mailto:{full_user.email}"
							>{full_user.email}</a
						>{/if}
					{#each [full_user.homeroom, full_user.graduationYear, full_user.osis ? `OSIS ${full_user.osis}` : ""].filter(Boolean) as detail}
						<span>{detail}</span>
					{/each}
				</p>
			</div>
			<div class="view-user__badges">
				<span class="badge" class:badge--success={full_user.member}
					>{full_user.member ? "ARISTA member" : "Student account"}</span
				>
				{#if full_user.bigSib}<span class="badge">Big Sib</span>{/if}
				{#if data.isAdmin && full_user.member}
					<form method="POST" action="?/set_big_sib" use:enhance>
						<input type="hidden" name="bigSib" value={full_user.bigSib ? "false" : "true"} />
						<button class="btn btn-sm btn-ghost" type="submit"
							>{full_user.bigSib ? "Remove Big Sib" : "Mark as Big Sib"}</button
						>
					</form>
				{/if}
			</div>
		</header>

		{#if full_user.member}
			<div class="view-user__records">
				<SemesterCreditPanel
					credits={full_user.credits}
					user={{ ...full_user, creditChoice }}
					semesters={data.creditSemesters ?? []}
					activeSemesterId={data.creditSemesters?.find((semester) => semester.active)?.id}
					requirements={data.creditRequirements ?? []}
				/>
				<StrikesDisplay strikes={full_user.strikes} canRemove={data.canManage} />
			</div>

			{#if data.canManage}
				<section class="focus panel" aria-labelledby="focus-title">
					<div>
						<h2 id="focus-title" class="section-title">Credit focus</h2>
						<p class="muted">
							Which category carries this member's bigger requirement this semester.
						</p>
					</div>
					<form
						method="POST"
						action="?/set_credit_choice"
						class="focus__form"
						use:enhance={({ formData }) => {
							const value = formData.get("creditChoice") === "true";
							return async ({ result, update }) => {
								if (result.type === "success") savedFocus = { id: full_user.id, value };
								await update({ invalidateAll: false, reset: false });
							};
						}}
					>
						<div class="radio-group" role="group" aria-label="Credit focus">
							<button
								type="submit"
								name="creditChoice"
								value="false"
								class="focus__option"
								class:active={!creditChoice}
								aria-pressed={!creditChoice}>More events</button
							>
							<button
								type="submit"
								name="creditChoice"
								value="true"
								class="focus__option"
								class:active={creditChoice}
								aria-pressed={creditChoice}>More tutoring</button
							>
						</div>
						<p class="focus__status" aria-live="polite">
							{#if choiceResult.choiceError}
								<span class="field-error">{choiceResult.choiceError}</span>
							{:else if choiceResult.choiceUpdated}
								Saved.
							{/if}
						</p>
					</form>
				</section>

				<section class="actions" aria-label="Record credit or a strike">
					<form class="panel" method="POST" action="?/credit_user" use:enhance>
						<h2 class="section-title">Add credit</h2>
						<label class="actions__type">
							<span class="field-label">Type</span>
							<select name="type" bind:value={$creditFormType}>
								<option value="event">Event</option>
								<option value="tutoring">Tutoring</option>
								<option value="other">Other</option>
								<option value="other_then_event">Other, then events</option>
								<option value="other_then_tutoring">Other, then tutoring</option>
							</select>
						</label>
						<InputField
							label="Credits"
							placeholder="1"
							field="credits"
							form={creditFormObj}
							type="number"
							inputmode="decimal"
							step="any"
						/>
						<InputField
							label="Reason"
							placeholder="Late addition to the Oct 12 cleanup"
							field="manualExplanation"
							form={creditFormObj}
						/>
						{#if $creditFormType === "other_then_event" || $creditFormType === "other_then_tutoring"}
							<p class="muted actions__hint">
								Fills the Other credits they still need this semester, then adds the rest to {$creditFormType ===
								"other_then_event"
									? "events"
									: "tutoring"}.
							</p>
						{/if}
						<button type="submit" class="btn btn-primary">Add credit</button>
						{#if creditedParts}
							<p class="actions__done" role="status">
								Added {creditedParts.map((part) => `${part.credits} ${part.type}`).join(" and ")} credits.
							</p>
						{/if}
					</form>
					<form class="panel" method="POST" action="?/strike_user" use:enhance>
						<h2 class="section-title">Add a strike</h2>
						<InputField
							label="Reason"
							placeholder="Missed a required meeting"
							field="reason"
							form={strikeFormObj}
						/>
						<InputField label="Weight" field="weight" form={strikeFormObj} />
						<button type="submit" class="btn btn-danger">Add strike</button>
					</form>
				</section>
			{/if}
		{:else}
			<div class="empty-state">
				<h2>This is a student account, not a member.</h2>
				<p>It can request tutoring, but it has no credits or strikes to manage.</p>
			</div>
		{/if}

		{#if data.tutoringSessions}
			<section class="panel tutoring-list" aria-labelledby="tutoring-title">
				<h2 id="tutoring-title" class="section-title">Tutoring sessions</h2>
				{#if fraudCount}
					<p class="notice notice--danger">
						{fraudCount} session{fraudCount === 1 ? " was" : "s were"} marked fraudulent. Open
						{fraudCount === 1 ? "it" : "them"} below for the reason and who decided.
					</p>
				{/if}
				{#if data.tutoringSessions.length === 0}
					<p class="muted">No tutoring sessions yet.</p>
				{:else}
					<ul>
						{#each data.tutoringSessions as session (session.id)}
							<li>
								<a href="/admin/tutoring/{session.id}">
									<span class="tutoring-list__main">
										<strong>{session.label}</strong>
										<span class="muted"
											>{session.role === "tutor" ? "Tutored" : "Tutored by"}
											{session.otherName}, {new Date(session.created).toLocaleDateString(
												undefined,
												{
													month: "short",
													day: "numeric",
													year: "numeric"
												}
											)}</span
										>
									</span>
									<span class="tutoring-list__badges">
										{#if session.fraud}<span class="badge badge--danger">Fraudulent</span
											>{:else if session.flagged}<span class="badge badge--danger">Flagged</span
											>{/if}
										{#if session.isComplete}
											<span class="badge badge--success">Complete</span>
										{:else if session.waiting}
											<span class="badge badge--warning">Waiting for proof</span>
										{:else}
											<span class="badge">Active</span>
										{/if}
									</span>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}
	{:else}
		<div class="empty-state">
			<h1>We couldn't find that account.</h1>
			<p>It may have been deleted.</p>
			<a class="btn btn-primary" href="/admin">Back to People</a>
		</div>
	{/if}
</main>

<style>
	.actions__hint,
	.actions__done {
		margin: 0;
		font-size: var(--text-sm);
	}
	.actions__done {
		color: var(--success, inherit);
		font-weight: 600;
	}
	.tutoring-list {
		margin-top: 1.25rem;
	}
	.tutoring-list ul {
		margin: 0.5rem 0 0;
		padding: 0;
		list-style: none;
	}
	.tutoring-list li + li {
		border-top: 1px solid var(--line);
	}
	.tutoring-list a {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		margin: 0 -0.6rem;
		padding: 0.7rem 0.6rem;
		border-radius: 10px;
		color: inherit;
		text-decoration: none;
	}
	.tutoring-list a:hover {
		background: var(--wash);
	}
	.tutoring-list__main {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}
	.tutoring-list__main .muted {
		font-size: var(--text-sm);
	}
	.tutoring-list__badges {
		display: flex;
		gap: 0.35rem;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		min-height: 2.75rem;
		margin: -0.5rem 0 0.75rem -0.4rem;
		padding: 0 0.6rem 0 0.4rem;
		border-radius: var(--radius-pill);
		color: var(--muted);
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: none;
	}
	.back:hover {
		background: var(--wash);
		color: var(--ink);
	}
	.back svg {
		width: 1.1rem;
		height: 1.1rem;
		fill: none;
		stroke: currentcolor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 2;
	}
	.view-user__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
	}
	.page-header p .text-link {
		font-weight: 500;
	}
	.focus {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 1.25rem;
	}
	.focus .muted {
		margin: 0.25rem 0 0;
		font-size: var(--text-sm);
	}
	.focus__form {
		display: grid;
		justify-items: end;
		gap: 0.35rem;
	}
	.focus__option {
		min-height: 2.25rem;
		padding: 0.35rem 1rem;
		border: 0;
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: var(--text-sm);
		font-weight: 600;
		cursor: pointer;
	}
	.focus__option.active {
		background: var(--surface);
		color: var(--ink);
		box-shadow:
			0 1px 2px rgb(22 39 90 / 12%),
			0 0 0 1px var(--line);
	}
	.focus__status {
		min-height: 1.1rem;
		margin: 0;
		color: var(--success);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.view-user__records {
		display: grid;
		gap: 1.25rem;
	}
	.actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.25rem;
		align-items: start;
		margin-top: 1.25rem;
	}
	.actions form {
		display: grid;
		justify-items: start;
		gap: 1rem;
	}
	.actions form > :global(*:not(.btn)) {
		width: 100%;
	}
	.actions__type {
		display: grid;
		gap: 0.4rem;
	}
	@media (max-width: 760px) {
		.actions {
			grid-template-columns: 1fr;
		}
	}
	.view-user__badges {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}
</style>
