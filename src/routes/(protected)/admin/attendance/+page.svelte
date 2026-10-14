<script lang="ts">
	import { enhance } from "$app/forms";
	import { page } from "$app/state";
	import AdminSubnav from "$lib/components/AdminSubnav.svelte";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
	const result = $derived((page.form ?? {}) as { meetingError?: string; meetingCreated?: boolean });

	function local(date: Date) {
		const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
		return shifted.toISOString().slice(0, 16);
	}
	const now = new Date();
	now.setSeconds(0, 0);
	const opensDefault = local(now);
	const closesDefault = local(new Date(now.getTime() + 2 * 60 * 60_000));
	const offset = now.getTimezoneOffset();

	function when(value: string) {
		return new Date(value).toLocaleString(undefined, {
			weekday: "short",
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit"
		});
	}
	function state(meeting: { opensAt: string; closesAt: string }) {
		const t = Date.now();
		if (t < Date.parse(meeting.opensAt)) return "upcoming";
		return t <= Date.parse(meeting.closesAt) ? "open" : "closed";
	}
</script>

<svelte:head><title>Attendance | ARISTA admin</title></svelte:head>

<main class="page page--tool attendance">
	<header class="page-header"><div><h1>Admin</h1></div></header>
	<AdminSubnav />

	<section class="panel start">
		<div>
			<h2 class="section-title">Check-in</h2>
			{#if data.openMeetings.length}
				<p>Open now: {data.openMeetings.map((meeting) => meeting.name).join(", ")}</p>
			{:else}
				<p class="muted">No meeting is open for check-in right now.</p>
			{/if}
		</div>
		<a class="btn btn-primary" href="/admin/attendance/check-in">Start check-in on this device</a>
	</section>

	{#if data.admin}
		<section class="panel">
			<h2 class="section-title">New meeting</h2>
			<form
				method="POST"
				action="?/create_meeting"
				class="new-meeting"
				use:enhance={({ formElement }) =>
					async ({ result, update }) => {
						await update({ reset: false });
						if (result.type === "success") {
							const name = formElement.elements.namedItem("name");
							if (name instanceof HTMLInputElement) name.value = "";
						}
					}}
			>
				<input type="hidden" name="offset" value={offset} />
				<label class="new-meeting__name">
					<span class="field-label">Name</span>
					<input name="name" placeholder="General Meeting" maxlength="120" required />
				</label>
				<label>
					<span class="field-label">Check-in opens</span>
					<input type="datetime-local" name="opensAt" value={opensDefault} required />
				</label>
				<label>
					<span class="field-label">Check-in closes</span>
					<input type="datetime-local" name="closesAt" value={closesDefault} required />
				</label>
				<button class="btn btn-primary" type="submit">Create meeting</button>
				{#if result.meetingError}<p class="field-error">{result.meetingError}</p>{/if}
			</form>
		</section>

		<section class="panel">
			<h2 class="section-title">Meetings</h2>
			{#if data.meetings.length === 0}
				<p class="muted">No meetings yet.</p>
			{:else}
				<ul class="meetings">
					{#each data.meetings as meeting (meeting.id)}
						{@const status = state(meeting)}
						<li>
							<div>
								<a class="text-link meetings__name" href="/admin/attendance/{meeting.id}"
									>{meeting.name}</a
								>
								<p class="muted">{when(meeting.opensAt)} to {when(meeting.closesAt)}</p>
							</div>
							<span
								class="badge"
								class:badge--success={status === "open"}
								class:badge--warning={status === "upcoming"}
								>{status === "open" ? "Open" : status === "upcoming" ? "Upcoming" : "Closed"}</span
							>
							<span class="meetings__count">{meeting.count} checked in</span>
							{#if status === "open"}
								<form method="POST" action="?/close_meeting" use:enhance>
									<input type="hidden" name="id" value={meeting.id} />
									<button class="btn btn-sm" type="submit">Close now</button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</main>

<style>
	.attendance {
		display: grid;
		gap: 1rem;
		align-content: start;
	}
	.start {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.start p {
		margin: 0.3rem 0 0;
	}
	.new-meeting {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 0.75rem;
		align-items: end;
		margin-top: 0.75rem;
	}
	.new-meeting label {
		display: grid;
		gap: 0.3rem;
	}
	.new-meeting__name {
		grid-column: 1 / -1;
	}
	.new-meeting button,
	.new-meeting .field-error {
		grid-column: 1 / -1;
		justify-self: start;
	}
	.new-meeting input {
		min-width: 0;
		width: 100%;
	}
	.meetings {
		display: grid;
		margin: 0.75rem 0 0;
		padding: 0;
		list-style: none;
	}
	.meetings li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto auto;
		gap: 0.75rem;
		align-items: center;
		padding: 0.75rem 0;
		border-top: 1px solid var(--line);
	}
	.meetings p {
		margin: 0.15rem 0 0;
		font-size: var(--text-sm);
	}
	.meetings__name {
		font-weight: 650;
	}
	.meetings__count {
		color: var(--muted);
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
	}
	@media (max-width: 640px) {
		.meetings li {
			grid-template-columns: minmax(0, 1fr) auto;
		}
	}
</style>
