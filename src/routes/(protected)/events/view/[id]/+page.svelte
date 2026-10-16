<script lang="ts">
	import { untrack } from "svelte";
	import { preventDefault } from "svelte/legacy";

	import type { PageData } from "./$types";
	import { enhance, deserialize, applyAction } from "$app/forms";
	import { isOnCommittee } from "$lib/isOnCommittee";
	import { currentUser } from "$lib/pocketbase";
	import { calculateEventCredits } from "$lib/calculateCredits";
	import { format } from "date-fns";
	import { invalidateAll } from "$app/navigation";
	import { superForm } from "sveltekit-superforms";
	import EventEditor from "$lib/components/EventEditor.svelte";
	import { getModalStore } from "$lib/skeleton-compat";
	import type { ActionResult } from "@sveltejs/kit";

	import { type ModalSettings } from "$lib/skeleton-compat";

	const modalStore = getModalStore();
	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
	let isCreditingAll = $state(false);
	// Turn pasted links into short, clickable ones ("themmrf.org/…") so a long
	// tracking URL doesn't stretch the page.
	const descriptionParts = $derived(
		(data.event.description ?? "").split(/(https?:\/\/[^\s<>"]+)/g).map((text, index) => {
			if (index % 2 === 0) return { text };
			const url = text.replace(/[).,!?;:]+$/, "");
			const trailing = text.slice(url.length);
			let label = url;
			try {
				const parsed = new URL(url);
				const rest = `${parsed.pathname}${parsed.search}`.replace(/^\/$/, "");
				label =
					parsed.hostname.replace(/^www\./, "") +
					(rest ? (rest.length > 24 ? `${rest.slice(0, 24)}…` : rest) : "");
			} catch {
				return { text };
			}
			return { url, label, trailing };
		})
	);
	const ownerId = $derived(data.event.event_owner);

	let organizerView = $state<"credit" | "roster">("credit");
	let rosterCopyMessage = $state("");
	let rosterCopyTimer: ReturnType<typeof setTimeout> | undefined;

	// Paste-ready lists for spreadsheets and emails. "Emails and names" is tab
	// separated with no header, so it drops into two spreadsheet columns.
	async function copyRoster(format: "names" | "emails" | "emails-and-names") {
		const volunteers = data.event.expand?.signed_up ?? [];
		if (volunteers.length === 0) return;
		const text =
			format === "names"
				? volunteers.map((volunteer) => volunteer.name).join("\n")
				: format === "emails"
					? volunteers.map((volunteer) => volunteer.email).join("\n")
					: volunteers.map((volunteer) => `${volunteer.email}\t${volunteer.name}`).join("\n");
		try {
			await navigator.clipboard.writeText(text);
			rosterCopyMessage =
				format === "emails-and-names"
					? `Copied ${volunteers.length} emails and names as two columns.`
					: `Copied ${volunteers.length} ${format}.`;
		} catch {
			rosterCopyMessage =
				"Couldn't copy. Check that the browser allows clipboard access, then try again.";
		}
		if (rosterCopyTimer) clearTimeout(rosterCopyTimer);
		rosterCopyTimer = setTimeout(() => (rosterCopyMessage = ""), 2600);
	}
	let creditAllFeedback = $state("");
	const uncreditedVolunteerCount = $derived(
		data.event.signed_up.filter((userId) => !data.credited_user_ids.includes(userId)).length
	);

	async function giveCredits(event: Event, user_id: string) {
		const formEl = event.target as HTMLFormElement;
		const data = new FormData(formEl);

		const response = await fetch(formEl.action, {
			method: "POST",
			body: JSON.stringify({
				user_id: user_id,
				credits: data.get("credits")
			})
		});
		if (!response.ok) return;

		// reset form
		formEl.reset();

		// rerun `load` function for the page
		await invalidateAll();
	}

	function creditAllVolunteers(event: Event) {
		const formEl = event.currentTarget as HTMLFormElement;
		const credits = String(new FormData(formEl).get("credits") ?? "").trim();
		creditAllFeedback = "";
		const confirmCredit: ModalSettings = {
			type: "confirm",
			title: `Credit ${uncreditedVolunteerCount} volunteer${uncreditedVolunteerCount === 1 ? "" : "s"}?`,
			body: `Each volunteer who hasn't been credited yet gets ${credits || "the entered"} event credit${credits === "1" ? "" : "s"}. Anyone already credited is skipped.`,
			confirmLabel: "Add credits",
			response: async (approved: boolean) => {
				if (!approved || isCreditingAll) return;
				isCreditingAll = true;
				try {
					const response = await fetch(`/events/view/${data.event.id}?/creditAllVolunteers`, {
						method: "POST",
						body: JSON.stringify({ credits }),
						headers: { "content-type": "application/json" }
					});
					if (!response.ok) {
						creditAllFeedback = "Could not credit volunteers. Check the amount and try again.";
						return;
					}
					await invalidateAll();
					creditAllFeedback = "Credits added for every eligible volunteer.";
				} finally {
					isCreditingAll = false;
				}
			}
		};
		modalStore.trigger(confirmCredit);
	}

	const formObj = superForm(
		untrack(() => data.update_form),
		{
			invalidateAll: "force",
			resetForm: false
		}
	);

	async function handleDeleteEvent(event: Event) {
		const confirmDelete: ModalSettings = {
			type: "confirm",
			title: "Delete event?",
			body: "This removes the event and everyone's sign-ups. It can't be undone.",
			confirmLabel: "Delete event",
			danger: true,
			response: async (r: boolean) => {
				if (r) {
					const fdata = new FormData();
					const response = await fetch(`/events/view/${data.event.id}?/delete_event`, {
						method: "POST",
						body: fdata
					});

					const result: ActionResult = deserialize(await response.text());

					if (result.type === "success") {
						// rerun all `load` functions, following the successful update
						await invalidateAll();
					}
					applyAction(result);
				}
			}
		};
		modalStore.trigger(confirmDelete);
	}
</script>

<svelte:head><title>{data.event.name} | ARISTA events</title></svelte:head>

<main class="page page--tool event">
	<a class="event__back" href="/events">
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
		All events
	</a>

	<div class="event__layout">
		<article class="event__main">
			<div class="event__badges">
				{#if data.event.isComplete}
					<span class="badge">Completed</span>
				{:else if data.event.signupStatus}
					<span class="badge badge--warning">Sign-ups closed</span>
				{:else}
					<span class="badge badge--success">Sign-ups open</span>
				{/if}
				{#if data.event.place}<span class="badge">{data.event.place}</span>{/if}
			</div>
			<h1>{data.event.name}</h1>
			{#if data.event.description}
				<!-- prettier-ignore -->
				<p class="event__description">{#each descriptionParts as part}{#if part.url}<a class="text-link" href={part.url} target="_blank" rel="noreferrer noopener">{part.label}</a>{part.trailing}{:else}{part.text}{/if}{/each}</p>
			{/if}

			<dl class="event__facts">
				<div>
					<dt>When</dt>
					<dd>
						{format(data.event.start_time, "EEEE, MMMM d")}<br />
						<span
							>{format(data.event.start_time, "h:mm a")} to {format(
								data.event.end_time,
								"h:mm a"
							)}</span
						>
					</dd>
				</div>
				<div>
					<dt>Where</dt>
					<dd>{data.event.location || "Location to be announced"}</dd>
				</div>
				<div>
					<dt>Credit</dt>
					<dd>
						{calculateEventCredits(data.event)} event credit{calculateEventCredits(data.event) === 1
							? ""
							: "s"}
						{#if data.event.multiplier !== 1}<br /><span>{data.event.multiplier}× multiplier</span
							>{/if}
					</dd>
				</div>
			</dl>
		</article>

		<aside class="event__signup panel">
			<p class="event__count">
				<strong>{data.event.signed_up.length}</strong>
				<span>of {data.event.intendedVolunteers} volunteers signed up</span>
			</p>
			<div
				class="meter"
				role="progressbar"
				aria-label="Volunteers signed up"
				aria-valuemin="0"
				aria-valuemax={data.event.intendedVolunteers}
				aria-valuenow={Math.min(data.event.signed_up.length, data.event.intendedVolunteers)}
			>
				<span
					style:width="{data.event.intendedVolunteers
						? Math.min(100, (data.event.signed_up.length / data.event.intendedVolunteers) * 100)
						: 0}%"
				></span>
			</div>
			{#if data.event.isComplete}
				<p class="event__status">This event is over. Thanks to everyone who came.</p>
			{:else if data.is_current_user_signed_up}
				<p class="event__status event__status--yes">
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
					You're signed up.
				</p>
				<form method="POST" action="?/event_unsign_up" use:enhance>
					<button type="submit" class="btn btn-ghost event__leave">Leave this event</button>
				</form>
			{:else}
				{#if data.event.signupStatus}
					<p class="event__status">
						The organizer has closed sign-ups. Only add yourself if they've asked you to.
					</p>
				{/if}
				<form method="POST" action="?/event_sign_up" use:enhance>
					<button type="submit" class="btn btn-primary btn-lg event__join">Sign up</button>
				</form>
			{/if}
		</aside>
	</div>

	{#if isOnCommittee($currentUser, "events") && !data.event.isComplete}
		<section class="organizer" aria-labelledby="organizer-title">
			<header>
				<h2 id="organizer-title">Run this event</h2>
			</header>

			<div class="organizer__tabs" role="group" aria-label="Organizer tools">
				<button
					type="button"
					aria-pressed={organizerView === "credit"}
					class:active={organizerView === "credit"}
					onclick={() => (organizerView = "credit")}>Credit volunteers</button
				>
				<button
					type="button"
					aria-pressed={organizerView === "roster"}
					class:active={organizerView === "roster"}
					onclick={() => (organizerView = "roster")}
					>Roster <span class="organizer__count">{data.event.signed_up.length}</span></button
				>
			</div>

			{#if organizerView === "credit"}
				<div class="organizer__panel">
					<div class="organizer__bulk panel panel--wash">
						<div>
							<h3>Credit everyone at once</h3>
							<p>
								{uncreditedVolunteerCount} still to credit, {data.credited_user_ids.length} already credited.
							</p>
						</div>
						<form onsubmit={preventDefault(creditAllVolunteers)}>
							<label for="credit-all-amount">Credits each</label>
							<input
								id="credit-all-amount"
								name="credits"
								type="number"
								min="0.01"
								max="100"
								step="0.01"
								value={calculateEventCredits(data.event)}
								required
							/>
							<button
								type="submit"
								class="btn btn-primary"
								disabled={uncreditedVolunteerCount === 0 || isCreditingAll}
							>
								{isCreditingAll
									? "Adding credits…"
									: uncreditedVolunteerCount === 0
										? "Everyone's credited"
										: `Credit ${uncreditedVolunteerCount} volunteer${uncreditedVolunteerCount === 1 ? "" : "s"}`}
							</button>
						</form>
						{#if creditAllFeedback}<p class="organizer__feedback" role="status">
								{creditAllFeedback}
							</p>{/if}
					</div>

					{#if data.event.expand?.signed_up?.length}
						<div class="table-container">
							<table class="table">
								<thead>
									<tr
										><th scope="col">Volunteer</th><th scope="col">Email</th><th scope="col"
											>Credit</th
										></tr
									>
								</thead>
								<tbody>
									{#each data.event.expand.signed_up as signed_up_user}
										<tr>
											<td
												><strong>{signed_up_user.name}</strong
												>{#if signed_up_user.id === ownerId}<span class="badge badge--organizer"
														>Organizer</span
													>{/if}{#if signed_up_user.preferredName}<span class="muted">
														({signed_up_user.preferredName})</span
													>{/if}</td
											>
											<td class="muted">{signed_up_user.email}</td>
											<td>
												{#if data.credited_user_ids.includes(signed_up_user.id)}
													<span class="badge badge--success">Credited</span>
												{:else}
													<form
														class="organizer__credit"
														onsubmit={preventDefault((e) => giveCredits(e, signed_up_user.id))}
														method="POST"
														action="?/giveCreditToUser"
													>
														<label class="sr-only" for={"credits-" + signed_up_user.id}
															>Credits for {signed_up_user.name}</label
														>
														<input
															id={"credits-" + signed_up_user.id}
															name="credits"
															type="number"
															min="0.01"
															max="100"
															step="0.01"
															value={calculateEventCredits(data.event)}
														/>
														<button type="submit" class="btn btn-sm">Credit</button>
													</form>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<p class="empty-state">No one has signed up yet.</p>
					{/if}
				</div>
			{:else}
				<div class="organizer__panel">
					{#if data.event.expand?.signed_up?.length}
						<div class="organizer__copy">
							<button type="button" class="btn btn-sm" onclick={() => copyRoster("names")}
								>Copy names</button
							>
							<button type="button" class="btn btn-sm" onclick={() => copyRoster("emails")}
								>Copy emails</button
							>
							<button
								type="button"
								class="btn btn-sm btn-primary"
								onclick={() => copyRoster("emails-and-names")}>Copy emails and names</button
							>
							<p class="organizer__feedback" aria-live="polite">{rosterCopyMessage}</p>
						</div>
						<div class="table-container">
							<table class="table">
								<thead>
									<tr
										><th scope="col" class="organizer__index">#</th><th scope="col">Name</th><th
											scope="col">Email</th
										></tr
									>
								</thead>
								<tbody>
									{#each data.event.expand.signed_up as volunteer, index (volunteer.id)}
										<tr>
											<td class="organizer__index muted">{index + 1}</td>
											<td
												><strong>{volunteer.name}</strong>{#if volunteer.id === ownerId}<span
														class="badge badge--organizer">Organizer</span
													>{/if}{#if volunteer.preferredName}<span class="muted">
														({volunteer.preferredName})</span
													>{/if}</td
											>
											<td
												><a class="text-link" href={`mailto:${volunteer.email}`}
													>{volunteer.email}</a
												></td
											>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<p class="empty-state">No one has signed up yet.</p>
					{/if}
				</div>
			{/if}

			<div class="organizer__actions">
				<form method="POST" action="?/mark_event_as_completed" use:enhance>
					<button type="submit" class="btn btn-primary">Mark event complete</button>
				</form>
			</div>

			<details class="organizer__edit">
				<summary>Edit event details</summary>
				<form method="POST" action="?/update_event" class="panel">
					<EventEditor {formObj} promptText="Update" />
				</form>
			</details>

			{#if $currentUser?.id === data.event.event_owner || isOnCommittee($currentUser, "admin")}
				<div class="organizer__danger">
					<div>
						<h3>Delete this event</h3>
						<p>This removes the event and its sign-ups. It can't be undone.</p>
					</div>
					<form method="POST" onsubmit={preventDefault(handleDeleteEvent)} action="?/delete_event">
						<button type="submit" class="btn btn-danger">Delete event</button>
					</form>
				</div>
			{/if}
		</section>
	{/if}
</main>

<style>
	.event__back {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		min-height: 2.75rem;
		margin: -0.5rem 0 1rem -0.4rem;
		padding: 0 0.6rem 0 0.4rem;
		border-radius: var(--radius-pill);
		color: var(--muted);
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: none;
		transition:
			background-color var(--dur-2) var(--ease-out),
			color var(--dur-2) var(--ease-out);
	}
	.event__back:hover {
		background: var(--wash);
		color: var(--ink);
	}
	.event__back svg {
		width: 1.1rem;
		height: 1.1rem;
		fill: none;
		stroke: currentcolor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 2;
	}
	.event__layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
		gap: clamp(1.5rem, 4vw, 3.5rem);
		align-items: start;
	}
	.event__badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.event__main h1 {
		margin-top: 0.85rem;
		font-size: clamp(2.25rem, 5vw, var(--text-4xl));
		font-variation-settings:
			"SOFT" 100,
			"WONK" 0;
		font-weight: 560;
		line-height: 1.02;
	}
	.badge--organizer {
		margin-left: 0.4rem;
		background: var(--flame-soft);
		color: var(--flame-text);
		vertical-align: 0.1em;
	}
	.event__description {
		overflow-wrap: anywhere;
		max-width: 44rem;
		margin: 1.1rem 0 0;
		color: var(--muted);
		font-size: var(--text-md);
		line-height: 1.65;
		white-space: pre-line;
	}
	.event__facts {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem 2rem;
		margin: 2rem 0 0;
		padding-top: 1.5rem;
		border-top: 1px solid var(--line);
	}
	.event__facts dt {
		color: var(--muted);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.event__facts dd {
		margin: 0.3rem 0 0;
		font-weight: 600;
		line-height: 1.45;
	}
	.event__facts dd span {
		color: var(--muted);
		font-weight: 400;
	}

	.event__signup {
		position: sticky;
		top: 5.5rem;
		display: grid;
		gap: 0.9rem;
	}
	.event__count {
		display: grid;
		gap: 0.15rem;
		margin: 0;
	}
	.event__count strong {
		font-family: var(--font-display);
		font-size: var(--text-3xl);
		font-variation-settings: "SOFT" 100;
		font-weight: 600;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.event__count span {
		color: var(--muted);
	}
	.event__status {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin: 0;
		color: var(--muted);
		font-size: var(--text-sm);
	}
	.event__status--yes {
		color: var(--success);
		font-size: var(--text-base);
		font-weight: 600;
	}
	.event__status svg {
		width: 1.25rem;
		height: 1.25rem;
		fill: none;
		stroke: currentcolor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 2.25;
	}
	.event__join,
	.event__leave {
		width: 100%;
	}

	.organizer {
		display: grid;
		gap: 1.25rem;
		margin-top: clamp(3rem, 6vw, 4.5rem);
		padding-top: clamp(2rem, 4vw, 3rem);
		border-top: 1px solid var(--line);
	}
	.organizer h2 {
		font-size: clamp(1.6rem, 3vw, var(--text-2xl));
	}
	.organizer h3 {
		font-family: var(--font-text);
		font-size: var(--text-base);
		font-weight: 650;
		letter-spacing: 0;
	}
	.organizer__bulk {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		justify-content: space-between;
		gap: 1rem 2rem;
	}
	.organizer__bulk p {
		margin: 0.25rem 0 0;
		color: var(--muted);
		font-size: var(--text-sm);
	}
	.organizer__bulk form {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
	}
	.organizer__bulk label {
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.organizer__bulk input {
		width: 6rem !important;
	}
	.organizer__feedback {
		flex-basis: 100%;
		margin: 0;
		color: var(--success);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.organizer__tabs {
		display: flex;
		gap: 0.25rem;
		border-bottom: 1px solid var(--line);
	}
	.organizer__tabs button {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		min-height: 2.75rem;
		padding: 0.5rem 0.9rem;
		border: 0;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.9375rem;
		font-weight: 600;
		cursor: pointer;
	}
	.organizer__tabs button:hover,
	.organizer__tabs button.active {
		color: var(--ink);
	}
	.organizer__tabs button.active::after {
		position: absolute;
		right: 0.9rem;
		bottom: -1px;
		left: 0.9rem;
		height: 2px;
		border-radius: 2px;
		background: var(--flame);
		content: "";
	}
	.organizer__count {
		display: inline-grid;
		place-items: center;
		min-width: 1.4rem;
		height: 1.4rem;
		padding: 0 0.35rem;
		border-radius: var(--radius-pill);
		background: var(--wash);
		color: var(--ink);
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
	}
	.organizer__panel {
		display: grid;
		gap: 1rem;
	}
	.organizer__copy {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}
	.organizer__copy .organizer__feedback {
		flex-basis: 100%;
		min-height: 1.25rem;
	}
	.organizer__index {
		width: 3.5rem;
		font-variant-numeric: tabular-nums;
	}
	.organizer__credit {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.organizer__credit input {
		width: 5rem !important;
		min-height: 2.25rem !important;
		padding: 0.35rem 0.55rem !important;
	}
	/* On phones, the volunteer tables stack: name, email, then the credit form,
	   instead of three columns that run off the screen. */
	@media (max-width: 640px) {
		.organizer__panel .table thead {
			display: none;
		}
		.organizer__panel .table,
		.organizer__panel .table tbody {
			display: block;
		}
		.organizer__panel .table tr {
			display: grid;
			grid-template-columns: auto 1fr;
			gap: 0.2rem 0.6rem;
			padding: 0.75rem 1rem;
			border-bottom: 1px solid var(--line);
		}
		.organizer__panel .table tr:last-child {
			border-bottom: 0;
		}
		.organizer__panel .table td {
			grid-column: 1 / -1;
			padding: 0;
			border: 0;
			overflow-wrap: anywhere;
		}
		.organizer__panel .table td.organizer__index {
			grid-column: 1;
			grid-row: 1;
			width: auto;
		}
		.organizer__panel .table td.organizer__index + td {
			grid-column: 2;
		}
		.organizer__credit {
			margin-top: 0.35rem;
		}
	}
	.organizer__edit summary {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		color: var(--link);
		font-weight: 600;
		cursor: pointer;
	}
	.organizer__edit form {
		margin-top: 0.75rem;
	}
	.organizer__danger {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 1rem;
		padding: 1.1rem 1.25rem;
		border: 1px solid color-mix(in srgb, var(--danger) 35%, var(--line));
		border-radius: var(--radius-panel);
	}
	.organizer__danger p {
		margin: 0.2rem 0 0;
		color: var(--muted);
		font-size: var(--text-sm);
	}

	@media (max-width: 900px) {
		.event__layout {
			grid-template-columns: 1fr;
		}
		.event__signup {
			position: static;
		}
	}
	@media (max-width: 640px) {
		.event__facts {
			grid-template-columns: 1fr;
		}
	}
</style>
