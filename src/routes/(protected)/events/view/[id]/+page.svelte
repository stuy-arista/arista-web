<script lang="ts">
	import type { PageData } from "./$types";
	import { enhance, deserialize, applyAction } from "$app/forms";
	import { isOnCommittee } from "$lib/isOnCommittee";
	import { currentUser } from "$lib/pocketbase";
	import { calculateEventCredits } from "$lib/calculateCredits";
	import { format } from "date-fns";
	import { invalidateAll } from "$app/navigation";
	import { superForm } from "sveltekit-superforms";
	import EventEditor from "$lib/components/EventEditor.svelte";
	import { getModalStore } from "@skeletonlabs/skeleton";
	import type { ActionResult } from "@sveltejs/kit";

	import { type ModalSettings } from "@skeletonlabs/skeleton";

	const modalStore = getModalStore();
	export let data: PageData;
	let eventsCommitteeView: "credit" | "roster" = "credit";
	let rosterCopyMessage = "";
	let rosterCopyTimer: ReturnType<typeof setTimeout> | undefined;

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
					? "Copied two spreadsheet columns."
					: `Copied ${format}.`;
		} catch {
			rosterCopyMessage = "Could not copy. Please try again.";
		}

		if (rosterCopyTimer) clearTimeout(rosterCopyTimer);
		rosterCopyTimer = setTimeout(() => (rosterCopyMessage = ""), 2600);
	}

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
		const responseData = await response.json();

		// { success: true, errors: {} } object

		// reset form
		formEl.reset();

		// rerun `load` function for the page
		await invalidateAll();
	}

	const formObj = superForm(data.update_form, {
		invalidateAll: "force",
		resetForm: false
	});

	async function handleDeleteEvent(
		event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement }
	) {
		const confirmDelete: ModalSettings = {
			type: "confirm",
			title: "Delete event",
			body: "Are you sure you want to delete the event?",
			response: async (r: boolean) => {
				if (r) {
					const fdata = new FormData();
					console.log("Deleting event", event.currentTarget);
					// @ts-ignore
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

<main class="container mx-auto p-8 space-y-8">
	<section>
		<h1 class="h1">{data.event.signupStatus ? "[Sign-Ups Closed] " : ""}{data.event.name} ({data.event.signed_up.length}/{data.event.intendedVolunteers} Volunteers)</h1>



		<p class="font-normal mt-2 text-lg">{data.event.description}</p>
		{#if data.event.isComplete}
			<aside class="alert variant-filled-success mt-2 mb-4">This event is already complete.</aside>
		{/if}
		<br />
		<p> <strong>Located at: </strong> {data.event.location}</p>
		<p> <strong> Place: </strong> {data.event.place}</p>
		<p class=""> <strong>Date: </strong>
			{format(data.event.start_time, "MM/dd/yyyy hh:mm a")} to {format(
				data.event.end_time,
				"MM/dd/yyyy hh:mm a"
			)}
		</p>
		<br>
		<p><strong>Intended Volunteers: </strong> {data.event.intendedVolunteers} People</p>
		<p><strong>Currently Signed-Up: </strong> {data.event.signed_up.length} People</p>
		<div class="mt-3">
			<p>
				Worth {calculateEventCredits(data.event)} credits, after applying a multiplier of
				{data.event.multiplier}x
			</p>
		</div>
		<br/>
		{#if !data.event.isComplete}
			{#if data.is_current_user_signed_up}
				<h3 class="h3">You are signed up for this event.</h3>
				<form method="POST" action="?/event_unsign_up" use:enhance>
					<button type="submit" class="btn variant-outline-secondary">Leave event</button>
				</form>
			{:else}
				{#if !data.event.signupStatus}
				<form method="POST" action="?/event_sign_up" use:enhance>
					<button type="submit" class="btn variant-filled-secondary">Sign up</button>
				</form>
					{/if}
			{/if}
		{/if}

		{#if isOnCommittee($currentUser, "events") && !data.event.isComplete}
			<div class="card p-4 w-full text-token space-y-4 mt-4">
				<hgroup>
					<h3 class="h3">For Events Committee:</h3>
					<p>
						This event should give
						<span class="font-bold underline"> {calculateEventCredits(data.event)} credits</span>,
						barring any commutes or latenesses.
					</p>
				</hgroup>
				<div class="inline-flex w-full sm:w-auto rounded-container-token bg-surface-200-700-token p-1" role="tablist" aria-label="Events committee tools">
					<button
						class="btn btn-sm {eventsCommitteeView === 'credit' ? 'variant-filled-secondary' : 'variant-ghost'} flex-1 sm:flex-none"
						type="button"
						role="tab"
						aria-selected={eventsCommitteeView === "credit"}
						on:click={() => (eventsCommitteeView = "credit")}
					>
						Credit volunteers
					</button>
					<button
						class="btn btn-sm {eventsCommitteeView === 'roster' ? 'variant-filled-secondary' : 'variant-ghost'} flex-1 sm:flex-none"
						type="button"
						role="tab"
						aria-selected={eventsCommitteeView === "roster"}
						on:click={() => (eventsCommitteeView = "roster")}
					>
						Volunteer roster ({data.event.signed_up.length})
					</button>
				</div>

				{#if eventsCommitteeView === "credit"}
					{#if data.event.expand}
						<div class="space-y-3" role="tabpanel">
							{#each data.event.expand.signed_up as signed_up_user}
								<div class="card p-4">
									<p><b>{signed_up_user.name}</b></p>
									<p>{signed_up_user.email}</p>
									{#if data.credited_user_ids.includes(signed_up_user.id)}
										<p>This user has already been credited.</p>
									{:else}
										<form
											class="flex items-end"
											on:submit|preventDefault={(e) => giveCredits(e, signed_up_user.id)}
											method="POST"
											action="?/giveCreditToUser"
										>
											<label for="credits">
												Enter the # of credits:
												<input
													class="input p-2"
													name="credits"
													type="numeric"
													value={calculateEventCredits(data.event)}
												/>
											</label>
											<button type="submit" class="btn variant-outline-tertiary h-fit">Credit</button>
										</form>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-surface-500-token">No volunteers have signed up yet.</p>
					{/if}
				{:else if data.event.expand}
					<div class="flex flex-wrap gap-2">
						<button class="btn btn-sm variant-outline-secondary" type="button" on:click={() => copyRoster("names")}>Copy names</button>
						<button class="btn btn-sm variant-outline-secondary" type="button" on:click={() => copyRoster("emails")}>Copy emails</button>
						<button class="btn btn-sm variant-filled-secondary" type="button" on:click={() => copyRoster("emails-and-names")}>Copy emails + names</button>
						{#if rosterCopyMessage}
							<p class="w-full text-sm text-success-500" aria-live="polite">{rosterCopyMessage}</p>
						{/if}
					</div>
					<div class="overflow-x-auto rounded-container-token border border-surface-300-600-token" role="tabpanel">
						<table class="w-full min-w-[32rem] text-left">
							<thead class="bg-surface-200-700-token text-xs uppercase tracking-wide text-surface-500-token">
								<tr>
									<th scope="col" class="w-14 px-4 py-3 font-semibold">#</th>
									<th scope="col" class="px-4 py-3 font-semibold">Name</th>
									<th scope="col" class="px-4 py-3 font-semibold">Email</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-surface-300-600-token">
								{#each data.event.expand.signed_up as signed_up_user, index}
									<tr class="transition-colors hover:bg-surface-100-800-token">
										<td class="px-4 py-3 text-surface-500-token">{index + 1}</td>
										<td class="px-4 py-3 font-semibold">{signed_up_user.name}</td>
										<td class="px-4 py-3"><a class="anchor" href={`mailto:${signed_up_user.email}`}>{signed_up_user.email}</a></td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<p class="text-surface-500-token">No volunteers have signed up yet.</p>
				{/if}
				<form class="mt-3" method="POST" action="?/mark_event_as_completed" use:enhance>
					<button type="submit" class="btn variant-filled-secondary">
						Mark event as completed
					</button>
				</form>
			</div>

			<form method="POST" action="?/update_event" class="card mt-4 p-4 w-full text-token space-y-4">
				<EventEditor {formObj} promptText="Update" />
			</form>
			{#if $currentUser?.id === data.event.event_owner || isOnCommittee($currentUser, "admin")}
				<form
					class="mt-4"
					method="POST"
					on:submit|preventDefault={handleDeleteEvent}
					action="?/delete_event"
				>
					<button type="submit" class="btn variant-filled-error">Delete Event</button>
				</form>
			{/if}
		{/if}
	</section>
</main>
