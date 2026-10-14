<script lang="ts">
	import { enhance } from "$app/forms";
	import AdminSubnav from "$lib/components/AdminSubnav.svelte";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
	let showAbsent = $state(false);

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
		<p class="meeting__stats">
			<strong>{data.checkIns.length}</strong> checked in ·
			<strong>{data.absent.length}</strong> members didn't
		</p>
	</section>

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
							use:enhance={({ cancel }) => {
								if (!confirm(`Remove ${checkIn.name}'s check-in?`)) cancel();
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
