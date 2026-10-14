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
				<fieldset class="new-meeting__mode">
					<legend class="field-label">How members check in</legend>
					<label class="choice">
						<input type="radio" name="mode" value="device" checked />
						<span><strong>Check-in devices</strong> Members line up at your approved devices.</span>
					</label>
					<label class="choice">
						<input type="radio" name="mode" value="self" />
						<span><strong>Their own phones</strong> Members scan a QR code and take a selfie.</span>
					</label>
				</fieldset>
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
								<p class="muted">
									{meeting.mode === "self" ? "Members' own phones, " : ""}{when(meeting.opensAt)} to {when(
										meeting.closesAt
									)}
								</p>
							</div>
							<span
								class="badge"
								class:badge--success={status === "open"}
								class:badge--warning={status === "upcoming"}
								>{status === "open" ? "Open" : status === "upcoming" ? "Upcoming" : "Closed"}</span
							>
							<span class="meetings__count">{meeting.count} checked in</span>
							<div class="meetings__actions">
								{#if status === "open"}
									<form method="POST" action="?/close_meeting" use:enhance>
										<input type="hidden" name="id" value={meeting.id} />
										<button class="btn btn-sm" type="submit">Close now</button>
									</form>
								{/if}
								<form
									method="POST"
									action="?/delete_meeting"
									use:enhance={({ cancel }) => {
										const extra = meeting.count
											? ` and its ${meeting.count} check-in${meeting.count === 1 ? "" : "s"} (photos already copied to Google Drive stay there)`
											: "";
										if (!confirm(`Delete "${meeting.name}"${extra}? This can't be undone.`))
											cancel();
									}}
								>
									<input type="hidden" name="id" value={meeting.id} />
									<button class="btn btn-sm btn-ghost meetings__delete" type="submit">Delete</button
									>
								</form>
							</div>
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
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: 0.75rem 1rem;
		align-items: end;
		margin-top: 0.75rem;
	}
	.new-meeting label {
		display: grid;
		gap: 0.3rem;
	}
	.new-meeting__mode {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 0.6rem;
		grid-column: 1 / -1;
		margin: 0;
		padding: 0;
		border: 0;
	}
	.new-meeting__mode legend {
		margin-bottom: 0.35rem;
		padding: 0;
	}
	.choice {
		display: grid !important;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.65rem;
		align-items: start;
		padding: 0.8rem 0.9rem;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--surface);
		cursor: pointer;
		transition:
			border-color var(--dur-2, 0.15s) ease,
			background-color var(--dur-2, 0.15s) ease;
	}
	.choice:hover {
		border-color: var(--line-strong, var(--line));
	}
	.choice:has(input:checked) {
		border-color: var(--seal, var(--ink));
		background: var(--wash);
	}
	.choice:has(input:focus-visible) {
		outline: 2px solid var(--seal, var(--ink));
		outline-offset: 2px;
	}
	.choice input[type="radio"] {
		width: 1.1rem;
		height: 1.1rem;
		min-height: 0;
		margin: 0.15rem 0 0;
		padding: 0;
		accent-color: var(--seal, var(--ink));
	}
	.choice strong {
		display: block;
		font-size: var(--text-sm);
	}
	.choice span {
		color: var(--muted);
		font-size: var(--text-sm);
		line-height: 1.45;
	}
	.choice span strong {
		color: var(--ink);
	}
	.new-meeting__name {
		grid-column: 1 / -1;
	}
	.new-meeting button,
	.new-meeting .field-error {
		grid-column: 1 / -1;
		justify-self: start;
	}
	.new-meeting input:not([type="radio"]) {
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
	.meetings__actions {
		display: flex;
		gap: 0.4rem;
		justify-content: end;
	}
	.meetings__delete {
		color: var(--danger);
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
