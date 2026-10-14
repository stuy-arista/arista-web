<script lang="ts">
	import { page } from "$app/state";
	import { confirmDialog } from "$lib/skeleton-compat";
	import { enhance } from "$app/forms";
	import AdminSubnav from "$lib/components/AdminSubnav.svelte";
	import { downloadQrPng, qrFilename } from "$lib/qrDownload";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
	let showAbsent = $state(false);
	let editing = $state(false);
	const editResult = $derived((page.form ?? {}) as { editError?: string });

	// "2026-10-15T15:30" in the viewer's time zone, for datetime-local inputs.
	function local(value: string) {
		const date = new Date(value);
		return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
	}
	let copied = $state(false);

	function time(value: string) {
		return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
	}
	function day(value: string) {
		return new Date(value).toLocaleDateString(undefined, {
			weekday: "long",
			month: "long",
			day: "numeric"
		});
	}
</script>

<svelte:head><title>{data.meeting.name} | ARISTA admin</title></svelte:head>

<main class="page page--tool meeting">
	<header class="page-header"><div><h1>Admin</h1></div></header>
	<AdminSubnav />

	<a class="back" href="/admin/attendance">
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
		Attendance
	</a>

	<section class="panel">
		<h2 class="meeting__title">{data.meeting.name}</h2>
		<p class="muted">
			{day(data.meeting.opensAt)}, check-in {time(data.meeting.opensAt)} to {time(
				data.meeting.closesAt
			)}
		</p>
		{#if data.meeting.instructions}
			<p class="meeting__message">Check-in message: {data.meeting.instructions}</p>
		{/if}
		<p class="meeting__stats">
			<strong>{data.checkIns.length}</strong> checked in ·
			<strong>{data.absent.length}</strong> members didn't
		</p>
		<details class="edit" bind:open={editing}>
			<summary>Edit meeting</summary>
			<form
				method="POST"
				action="?/update_meeting"
				class="edit__form"
				use:enhance={() =>
					async ({ result, update }) => {
						await update({ reset: false });
						if (result.type === "success") editing = false;
					}}
			>
				<input type="hidden" name="offset" value={new Date().getTimezoneOffset()} />
				<label class="edit__wide">
					<span class="field-label">Name</span>
					<input name="name" value={data.meeting.name} maxlength="120" required />
				</label>
				<label class="edit__wide">
					<span class="field-label">Message at check-in <span class="muted">(optional)</span></span>
					<input
						name="instructions"
						value={data.meeting.instructions}
						maxlength="300"
						placeholder="Upload a picture with your ARISTA shirt"
					/>
				</label>
				<label>
					<span class="field-label">Check-in opens</span>
					<input
						type="datetime-local"
						name="opensAt"
						value={local(data.meeting.opensAt)}
						required
					/>
				</label>
				<label>
					<span class="field-label">Check-in closes</span>
					<input
						type="datetime-local"
						name="closesAt"
						value={local(data.meeting.closesAt)}
						required
					/>
				</label>
				<p class="muted edit__wide">
					{data.meeting.mode === "self"
						? "Members check in on their own phones. The QR code stays the same after edits."
						: "Members check in at the check-in devices."}
				</p>
				<div class="edit__wide edit__actions">
					<button class="btn btn-primary" type="submit">Save changes</button>
					<button class="btn btn-ghost" type="button" onclick={() => (editing = false)}
						>Cancel</button
					>
				</div>
				{#if editResult.editError}<p class="field-error edit__wide">{editResult.editError}</p>{/if}
			</form>
		</details>
	</section>

	{#if data.link}
		<section class="panel share">
			<!-- The SVG comes from our own QR generator, not user input. -->
			<div class="share__qr">{@html data.qr}</div>
			<div class="share__text">
				<h2 class="section-title">Check-in link</h2>
				<p>
					Show this QR code (or share the link). Members scan it, sign in if they need to, and take
					a selfie on their own phone. It only works while check-in is open.
				</p>
				<p class="share__link"><a class="text-link" href={data.link}>{data.link}</a></p>
				<div class="share__actions">
					<button
						class="btn btn-sm"
						type="button"
						onclick={async () => {
							await navigator.clipboard.writeText(data.link);
							copied = true;
							setTimeout(() => (copied = false), 2000);
						}}>{copied ? "Copied" : "Copy link"}</button
					>
					<a class="btn btn-sm" href="/admin/attendance/{data.meeting.id}/qr" target="_blank"
						>Show QR full screen</a
					>
					<button
						class="btn btn-sm"
						type="button"
						onclick={() => downloadQrPng(data.qr, qrFilename(data.meeting.name))}
						>Download PNG</button
					>
				</div>
			</div>
		</section>
	{/if}

	<section class="panel">
		<h2 class="section-title">Checked in</h2>
		{#if data.checkIns.length === 0}
			<p class="muted">Nobody has checked in yet.</p>
		{:else}
			<ul class="checkins">
				{#each data.checkIns as checkIn (checkIn.id)}
					<li>
						{#if checkIn.hasPhoto}
							<a href="/admin/attendance/photo/{checkIn.id}" target="_blank" rel="noreferrer">
								<img
									src="/admin/attendance/photo/{checkIn.id}"
									alt="Check-in photo of {checkIn.name}"
									loading="lazy"
								/>
							</a>
						{:else}
							<div class="checkins__nophoto">Photo removed after 30 days</div>
						{/if}
						<div class="checkins__info">
							<a class="text-link" href="/admin/view_user/{checkIn.userId}">{checkIn.name}</a>
							<span class="muted"
								>{time(checkIn.time)}{checkIn.takenBy
									? ` on ${checkIn.takenBy}'s device`
									: ""}</span
							>
						</div>
						<form
							method="POST"
							action="?/remove_check_in"
							use:enhance={async ({ cancel }) => {
								const ok = await confirmDialog({
									title: "Remove check-in?",
									body: `${checkIn.name} will show as not checked in to this meeting.`,
									confirmLabel: "Remove check-in",
									danger: true
								});
								if (!ok) cancel();
							}}
						>
							<input type="hidden" name="id" value={checkIn.id} />
							<button class="btn btn-sm" type="submit">Remove</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="panel">
		<div class="absent__head">
			<h2 class="section-title">Didn't check in ({data.absent.length})</h2>
			<button class="btn btn-sm" type="button" onclick={() => (showAbsent = !showAbsent)}
				>{showAbsent ? "Hide" : "Show"}</button
			>
		</div>
		{#if showAbsent}
			<ul class="absent">
				{#each data.absent as person (person.id)}
					<li>
						<a class="text-link" href="/admin/view_user/{person.id}">{person.name}</a>
						<span class="muted">{person.graduationYear}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</main>

<style>
	.meeting {
		display: grid;
		gap: 1rem;
		align-content: start;
	}
	.back {
		display: inline-flex;
		align-items: center;
		justify-self: start;
		gap: 0.25rem;
		min-height: 2.75rem;
		margin-left: -0.4rem;
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
	.share {
		display: grid;
		grid-template-columns: minmax(8rem, 12rem) minmax(0, 1fr);
		gap: 1.25rem;
		align-items: center;
	}
	.share__qr :global(svg) {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 12px;
		box-shadow: 0 0 0 1px var(--line);
	}
	.share__text p {
		margin: 0.4rem 0 0;
	}
	.share__link {
		overflow-wrap: anywhere;
		font-size: var(--text-sm);
	}
	.share__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	@media (max-width: 560px) {
		.share {
			grid-template-columns: 1fr;
		}
		.share__qr {
			max-width: 14rem;
		}
	}
	.meeting__message {
		padding: 0.5rem 0.75rem;
		border-left: 3px solid var(--flame);
		border-radius: 0 8px 8px 0;
		background: var(--surface-sunken);
		font-size: var(--text-sm);
	}
	.edit {
		margin-top: 1rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--line);
	}
	.edit summary {
		width: fit-content;
		font-size: var(--text-sm);
		font-weight: 650;
		cursor: pointer;
	}
	.edit__form {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: 0.75rem 1rem;
		margin-top: 0.75rem;
	}
	.edit__form label {
		display: grid;
		gap: 0.3rem;
	}
	.edit__form input {
		width: 100%;
		min-width: 0;
	}
	.edit__wide {
		grid-column: 1 / -1;
	}
	.edit__actions {
		display: flex;
		gap: 0.5rem;
	}
	.meeting__title {
		margin: 0;
	}
	.meeting p {
		margin: 0.3rem 0 0;
	}
	.checkins {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
		gap: 1rem;
		margin: 0.75rem 0 0;
		padding: 0;
		list-style: none;
	}
	.checkins li {
		display: grid;
		gap: 0.5rem;
		align-content: start;
	}
	.checkins img,
	.checkins__nophoto {
		display: grid;
		place-items: center;
		width: 100%;
		aspect-ratio: 4 / 3;
		border-radius: 10px;
		background: var(--surface-sunken);
		object-fit: cover;
		color: var(--muted);
		font-size: var(--text-xs);
		text-align: center;
	}
	.checkins__info {
		display: grid;
		font-size: var(--text-sm);
	}
	.checkins__info a {
		font-weight: 650;
	}
	.checkins form button {
		justify-self: start;
	}
	.absent__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.absent {
		columns: 15rem;
		margin: 0.75rem 0 0;
		padding: 0;
		list-style: none;
	}
	.absent li {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.3rem 0;
		break-inside: avoid;
		font-size: var(--text-sm);
	}
</style>
