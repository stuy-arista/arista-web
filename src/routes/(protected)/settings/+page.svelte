<script lang="ts">
	import { untrack } from "svelte";
	import { preventDefault } from "svelte/legacy";
	import type { PageData } from "./$types";
	import { beforeNavigate, goto, invalidateAll } from "$app/navigation";
	import { page } from "$app/state";
	import { superForm } from "sveltekit-superforms";
	import { pb, currentUser } from "$lib/pocketbase";
	import { accountThemeStorageKey, activeThemeOverride } from "$lib/theme";
	import { enhance, deserialize, applyAction } from "$app/forms";
	import ErrorComponent from "$lib/components/ErrorComponent.svelte";
	import InputField from "$lib/components/InputField.svelte";
	import { type ModalSettings, confirmDialog, getModalStore } from "$lib/skeleton-compat";
	import type { ActionResult } from "@sveltejs/kit";
	import { displayName, initials } from "$lib/displayName";

	const modalStore = getModalStore();

	// Typing in the profile or password form marks it unsaved until it's
	// submitted; leaving the page first asks before throwing the edits away.
	let unsavedEdits = $state(false);
	const markUnsaved = () => (unsavedEdits = true);
	const markSaved = () => (unsavedEdits = false);
	// Navigation can't wait for an answer, so stop it, ask in our own dialog,
	// and go on to the same place if they choose to leave.
	beforeNavigate(({ cancel, type, to }) => {
		if (!unsavedEdits || type === "leave" || !to) return;
		cancel();
		confirmDialog({
			title: "Leave without saving?",
			body: "You have unsaved changes in Settings.",
			confirmLabel: "Leave without saving",
			danger: true
		}).then((leave) => {
			if (!leave) return;
			unsavedEdits = false;
			goto(to.url);
		});
	});
	function warnBeforeUnload(event: BeforeUnloadEvent) {
		if (unsavedEdits) event.preventDefault();
	}
	async function logout() {
		await fetch("/logout", { method: "POST" });
		pb.authStore.clear();
		currentUser.set(undefined);
		await invalidateAll();
		await goto("/");
	}
	interface Props {
		data: PageData;
	}
	let { data }: Props = $props();
	const formObj = superForm(untrack(() => data.form));
	const { form, errors } = formObj;
	type ThemePreference = "system" | "light" | "dark";
	let themeForm: HTMLFormElement | null = $state(null);
	let themePreference = $state<ThemePreference>("system");
	let isThemeSubmitting = $state(false);
	let themeUserId = $state<string | null>(null);
	$effect(() => {
		const user = $currentUser;
		if (user?.id && user.id !== themeUserId) {
			themePreference = (user.themePreference ?? "system") as ThemePreference;
			themeUserId = user.id;
		}
	});
	let profileActionResult = $derived(
		(page.form ?? {}) as { profileUpdated?: boolean; profileError?: string }
	);
	let emailPrefResult = $derived(
		(page.form ?? {}) as { emailPrefUpdated?: boolean; emailPrefError?: string }
	);
	let themeActionResult = $derived(
		(page.form ?? {}) as { themeUpdated?: boolean; themeError?: string }
	);
	function chooseTheme(preference: ThemePreference) {
		if (!themeForm || isThemeSubmitting || themePreference === preference) return;
		themePreference = preference;
		const user = $currentUser;
		if (user) {
			currentUser.set({ ...user, themePreference: preference });
			if (preference === "system") {
				activeThemeOverride.set(null);
				window.localStorage.removeItem(accountThemeStorageKey(user.id));
			} else {
				activeThemeOverride.set(preference);
				window.localStorage.setItem(accountThemeStorageKey(user.id), preference);
			}
		}
		isThemeSubmitting = true;
		setTimeout(() => themeForm?.requestSubmit(), 0);
	}
	async function handleDeleteAccount(event: Event) {
		const confirmDelete: ModalSettings = {
			type: "confirm",
			title: "Delete your account?",
			body: "Your ARISTA account will be deleted and you'll be signed out. This can't be undone.",
			confirmLabel: "Delete my account",
			danger: true,
			response: async (r: boolean) => {
				if (r) {
					const response = await fetch("/settings?/delete_account", {
						method: "POST",
						body: new FormData()
					});
					const result: ActionResult = deserialize(await response.text());
					if (result.type === "success") await invalidateAll();
					logout();
					applyAction(result);
				}
			}
		};
		modalStore.trigger(confirmDelete);
	}
</script>

<svelte:window onbeforeunload={warnBeforeUnload} />

<svelte:head><title>Settings | ARISTA</title></svelte:head>

<main class="page settings">
	<header class="page-header">
		<div>
			<h1>Settings</h1>
		</div>
	</header>

	{#if $currentUser}
		<div class="settings__layout">
			<section class="profile panel" aria-labelledby="profile-name">
				<div class="profile__head">
					<span class="profile__avatar" aria-hidden="true">{initials($currentUser)}</span>
					<div>
						<h2 id="profile-name">{displayName($currentUser)}</h2>
						<span class="badge" class:badge--success={$currentUser.member}
							>{$currentUser.member ? "ARISTA member" : "Student account"}</span
						>
					</div>
				</div>
				<dl class="profile__details">
					{#if $currentUser.preferredName}
						<div class="profile__wide">
							<dt>Legal name</dt>
							<dd>{$currentUser.name}</dd>
						</div>
					{/if}
					<div class="profile__wide">
						<dt>Email</dt>
						<dd>{$currentUser.email}</dd>
					</div>
					<div>
						<dt>Graduation year</dt>
						<dd>{$currentUser.graduationYear}</dd>
					</div>
					<div>
						<dt>Homeroom</dt>
						<dd>{$currentUser.homeroom}</dd>
					</div>
					<div>
						<dt>OSIS</dt>
						<dd>{$currentUser.osis}</dd>
					</div>
					{#if $currentUser.member}
						<div class="profile__wide">
							<dt>Committees</dt>
							<dd>
								{$currentUser.committees
									.map((committee) => committee.charAt(0).toUpperCase() + committee.slice(1))
									.join(", ") || "None yet"}
							</dd>
						</div>
					{/if}
				</dl>
				<p class="profile__help">
					Something wrong here? Email
					<a class="text-link" href="mailto:stuyaristanycweb@gmail.com"
						>stuyaristanycweb@gmail.com</a
					>
					and the web team will fix it.
				</p>
			</section>

			<div class="settings__stack">
				<section class="panel" aria-labelledby="about-you-title">
					<h2 id="about-you-title" class="section-title">About you</h2>
					<form
						oninput={markUnsaved}
						onsubmit={markSaved}
						method="POST"
						action="?/update_profile"
						class="profile-form"
						use:enhance={() =>
							async ({ result }) => {
								await applyAction(result);
								await invalidateAll();
							}}
					>
						<div class="profile-form__field">
							<label for="preferredName">Preferred first name</label>
							<input
								id="preferredName"
								name="preferredName"
								maxlength="32"
								autocomplete="given-name"
								placeholder={$currentUser.name.split(" ")[0]}
								value={$currentUser.preferredName ?? ""}
							/>
						</div>
						<div class="profile-form__field">
							<label for="contactInfo">Contact info for tutoring</label>
							<textarea
								id="contactInfo"
								name="contactInfo"
								maxlength="600"
								rows="3"
								placeholder="Instagram, phone number, Discord, best times to reach you"
								>{data.contactInfo}</textarea
							>
						</div>
						<button type="submit" class="btn btn-primary">Save</button>
						<p class="panel__status" aria-live="polite">
							{#if profileActionResult.profileError}
								<span class="field-error">{profileActionResult.profileError}</span>
							{:else if profileActionResult.profileUpdated}
								Saved.
							{/if}
						</p>
					</form>
				</section>

				<section class="panel" aria-labelledby="appearance-title">
					<h2 id="appearance-title" class="section-title appearance__title">Appearance</h2>
					<form
						bind:this={themeForm}
						method="POST"
						action="?/update_theme_preference"
						use:enhance={() =>
							async ({ result }) => {
								try {
									await applyAction(result);
									await invalidateAll();
								} finally {
									isThemeSubmitting = false;
								}
							}}
					>
						<input type="hidden" name="themePreference" value={themePreference} />
						<div class="segmented" role="group" aria-label="Color mode">
							{#each [["system", "Match my device"], ["light", "Light"], ["dark", "Dark"]] as [value, label]}
								<button
									type="button"
									class:active={themePreference === value}
									aria-pressed={themePreference === value}
									onclick={() => chooseTheme(value as ThemePreference)}>{label}</button
								>
							{/each}
						</div>
					</form>
					<p class="panel__status" aria-live="polite">
						{#if themeActionResult.themeError}
							<span class="field-error">{themeActionResult.themeError}</span>
						{:else if themeActionResult.themeUpdated}
							Saved.
						{/if}
					</p>
				</section>

				<section class="panel" aria-labelledby="emails-title">
					<h2 id="emails-title" class="section-title appearance__title">Message emails</h2>
					<p class="muted emails__hint">
						If a tutoring message sits unread for 30 minutes, we email you. Each message is only
						emailed once, and nothing is sent if you've already read it.
					</p>
					<form
						method="POST"
						action="?/update_message_emails"
						use:enhance={() =>
							async ({ result }) => {
								await applyAction(result);
								await invalidateAll();
							}}
					>
						<div class="segmented" role="group" aria-label="Message emails">
							<button
								type="submit"
								name="enabled"
								value="true"
								class:active={!$currentUser?.muteMessageEmails}
								aria-pressed={!$currentUser?.muteMessageEmails}>On</button
							>
							<button
								type="submit"
								name="enabled"
								value="false"
								class:active={!!$currentUser?.muteMessageEmails}
								aria-pressed={!!$currentUser?.muteMessageEmails}>Off</button
							>
						</div>
					</form>
					<p class="panel__status" aria-live="polite">
						{#if emailPrefResult.emailPrefError}
							<span class="field-error">{emailPrefResult.emailPrefError}</span>
						{:else if emailPrefResult.emailPrefUpdated}
							Saved.
						{/if}
					</p>
				</section>

				<section class="panel" aria-labelledby="password-title">
					<h2 id="password-title" class="section-title">Change password</h2>
					<form
						oninput={markUnsaved}
						onsubmit={markSaved}
						method="POST"
						action="?/change_password"
						class="password-form"
						use:enhance
					>
						<ErrorComponent errors={$errors} />
						<InputField
							form={formObj}
							field="password"
							label="Current password"
							type="password"
							autocomplete="current-password"
						/>
						<InputField
							form={formObj}
							field="newPassword"
							label="New password"
							type="password"
							autocomplete="new-password"
						/>
						<InputField
							form={formObj}
							field="newPasswordConfirm"
							label="Confirm new password"
							type="password"
							autocomplete="new-password"
						/>
						<button type="submit" class="btn btn-primary">Update password</button>
					</form>
				</section>
			</div>
		</div>

		<section class="account" aria-label="Account">
			<button type="button" onclick={logout} class="btn">Sign out</button>
			<div class="account__danger">
				<div>
					<h2>Delete account</h2>
					<p>Permanently remove your ARISTA account.</p>
				</div>
				<form
					method="POST"
					onsubmit={preventDefault(handleDeleteAccount)}
					action="?/delete_account"
				>
					<button type="submit" class="btn btn-danger">Delete account</button>
				</form>
			</div>
		</section>
	{:else}
		<div class="empty-state">
			<h2>Sign in to see your settings.</h2>
			<a class="btn btn-primary" href="/login">Sign in</a>
		</div>
	{/if}
</main>

<style>
	.settings__layout {
		display: grid;
		grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
		gap: 1.25rem;
		align-items: start;
	}
	.settings__stack {
		display: grid;
		gap: 1.25rem;
	}
	.profile {
		position: sticky;
		top: 5.5rem;
		display: grid;
		gap: 1.25rem;
	}
	.profile__head {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.profile__head > div {
		display: grid;
		justify-items: start;
		gap: 0.35rem;
	}
	.profile__head h2 {
		font-size: var(--text-xl);
	}
	.profile__avatar {
		display: grid;
		flex: 0 0 auto;
		place-items: center;
		width: 3.5rem;
		height: 3.5rem;
		border-radius: 50%;
		background: var(--seal);
		color: #fff;
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 600;
	}
	:global(.dark) .profile__avatar {
		background: var(--action);
		color: var(--on-action);
	}
	.profile__details {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		margin: 0;
		padding-top: 1.25rem;
		border-top: 1px solid var(--line);
	}
	.profile__wide {
		grid-column: 1 / -1;
	}
	.profile__details dt {
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.profile__details dd {
		margin: 0.15rem 0 0;
		font-weight: 500;
		overflow-wrap: anywhere;
		font-variant-numeric: tabular-nums;
	}
	.profile__help {
		margin: 0;
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.panel__status {
		min-height: 1.25rem;
		margin: 0.6rem 0 0;
		color: var(--success);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.segmented {
		display: inline-flex;
		flex-wrap: wrap;
		padding: 0.25rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-pill);
		background: var(--surface-sunken);
	}
	.segmented button {
		min-height: 2.5rem;
		padding: 0.35rem 1.1rem;
		border: 0;
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: var(--text-sm);
		font-weight: 600;
		cursor: pointer;
		transition:
			background-color var(--dur-2) var(--ease-out),
			color var(--dur-2) var(--ease-out);
	}
	.segmented button.active {
		background: var(--surface);
		color: var(--ink);
		box-shadow:
			0 1px 2px rgb(22 39 90 / 12%),
			0 0 0 1px var(--line);
	}
	.emails__hint {
		margin: -0.25rem 0 0.85rem;
		font-size: var(--text-sm);
	}
	.appearance__title {
		margin-bottom: 1rem;
	}
	.profile-form {
		display: grid;
		justify-items: start;
		gap: 1rem;
		margin-top: 1rem;
	}
	.profile-form__field {
		display: grid;
		gap: 0.4rem;
		width: 100%;
	}
	.profile-form__field label {
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.profile-form .panel__status {
		margin: 0;
	}
	.password-form {
		display: grid;
		justify-items: start;
		gap: 1rem;
		margin-top: 1rem;
	}
	.password-form > :global(*:not(.btn)) {
		width: 100%;
	}

	.account {
		display: grid;
		justify-items: start;
		gap: 1.25rem;
		margin-top: clamp(2rem, 5vw, 3rem);
		padding-top: clamp(1.5rem, 4vw, 2rem);
		border-top: 1px solid var(--line);
	}
	.account__danger {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		width: 100%;
		padding: 1.1rem 1.25rem;
		border: 1px solid color-mix(in srgb, var(--danger) 35%, var(--line));
		border-radius: var(--radius-panel);
	}
	.account__danger h2 {
		font-family: var(--font-text);
		font-size: var(--text-base);
		font-weight: 650;
		letter-spacing: 0;
	}
	.account__danger p {
		margin: 0.2rem 0 0;
		color: var(--muted);
		font-size: var(--text-sm);
	}

	@media (max-width: 860px) {
		.settings__layout {
			grid-template-columns: 1fr;
		}
		.profile {
			position: static;
		}
	}
</style>
