<script lang="ts">
	import type { PageData } from "./$types";
	import { goto, invalidateAll } from "$app/navigation";
	import { page } from "$app/stores";
	import { superForm } from "sveltekit-superforms";
	import { get } from "svelte/store";
	import { pb, currentUser } from "$lib/pocketbase";
	import { calculateRequiredCredits } from "$lib/calculateCredits";
	import { enhance, deserialize, applyAction } from "$app/forms";
	import ErrorComponent from "$lib/components/ErrorComponent.svelte";
	import InputField from "$lib/components/InputField.svelte";
	import { type ModalSettings, getModalStore, SlideToggle } from "@skeletonlabs/skeleton";
	import type { ActionResult } from "@sveltejs/kit";

	const modalStore = getModalStore();

	async function logout() {
		await fetch("/logout", { method: "POST" });
		pb.authStore.clear();
		currentUser.set(undefined);
		await goto("/", { invalidateAll: true });
	}

	export let data: PageData;
	const formObj = superForm(data.form);
	const { form, errors, constraints } = formObj;

	function resolveChoiceMode(user: { choice?: unknown; priority?: unknown } | null | undefined): boolean {
		return user?.choice === true || user?.priority === true;
	}

	let choiceForm: HTMLFormElement | null = null;
	let choiceMode = false;
	let isChoiceSubmitting = false;
	let currentChoiceUserId: string | null = null;
	$: {
		const user = $currentUser;
		const userId = user?.id ?? null;
		if (userId !== currentChoiceUserId) {
			currentChoiceUserId = userId;
			choiceMode = resolveChoiceMode(user);
		}
	}
	$: choiceActionResult = ($page.form ?? {}) as {
		choiceUpdated?: boolean;
		choiceError?: string;
	};

	function syncChoiceModeFromStore() {
		choiceMode = resolveChoiceMode(get(currentUser));
	}

	function submitChoiceForm() {
		if (!choiceForm || isChoiceSubmitting) {
			return;
		}
		isChoiceSubmitting = true;
		setTimeout(() => {
			choiceForm?.requestSubmit();
		}, 0);
	}

	async function handleDeleteAccount(
		event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement }
	) {
		const confirmDelete: ModalSettings = {
			type: "confirm",
			title: "Delete account",
			body: "Are you sure you want to delete your account?",
			response: async (r: boolean) => {
				if (r) {
					const data = new FormData();
					console.log("Deleting account", event.currentTarget);
					// @ts-ignore
					const response = await fetch("/settings?/delete_account", {
						method: "POST",
						body: data
					});

					const result: ActionResult = deserialize(await response.text());

					if (result.type === "success") {
						// rerun all `load` functions, following the successful update
						await invalidateAll();
					}
					logout();
					applyAction(result);
				}
			}
		};
		modalStore.trigger(confirmDelete);
	}
</script>

<main class="container mx-auto p-8 space-y-8">
	<h1 class="h1">Settings</h1>
	{#if $currentUser}
		<section class="card p-4 w-full text-token">
			<h3 class="h3">Profile</h3>
			<p class="mb-4">
				Please contact <code class="font-bold">stuyaristanycweb@gmail.com</code> with any issues.
			</p>
			<p>Name: {$currentUser.name}</p>
			<p>Email: {$currentUser.email}</p>
			<p>Graduation Year: {$currentUser.graduationYear}</p>
			<p>OSIS: {$currentUser.osis}</p>
			<p>Homeroom: {$currentUser.homeroom}</p>
			<p>Committees: {$currentUser.committees.join(", ")}</p>
			<p class="mt-2">
				Your account is of type
				<span class="font-bold">"{$currentUser.is_tutee ? "tutee" : "ARISTA member"}"</span>.
			</p>
			{#if !$currentUser?.is_tutee}
			<p class="italic mb-2">
				Note: If you are NOT an ARISTA member (ie: you are here to be tutored) but your account type
				is, <span class="underline">please delete your account and make a new one as a member</span>
				by checking the approriate checkbox.
			</p>
				{/if}
			{#if $currentUser?.is_tutee}
			<p class="italic mb-2">
				Note: If you ARE an ARISTA member but your account type
				isn't, <span class="underline">do not delete your account, contact support.</span>
			</p>
				{/if}
			{#if !$currentUser?.is_tutee}
					<form
						bind:this={choiceForm}
						method="POST"
						action="?/toggle_choice"
					class="card p-4 my-4 space-y-3"
					use:enhance={() => {
						return async ({ result }) => {
							try {
								await applyAction(result);
								pb.authStore.loadFromCookie(document.cookie);
								await invalidateAll();
								pb.authStore.loadFromCookie(document.cookie);
								syncChoiceModeFromStore();
							} finally {
								isChoiceSubmitting = false;
							}
						};
					}}
					>
						<h4 class="h4">Credit Requirement Mode</h4>
						<p class="text-sm">
							Swap tutoring and event requirements.
						</p>
					{#if choiceActionResult.choiceUpdated}
						<p class="text-sm text-success-600 dark:text-success-500">Requirement mode saved.</p>
					{/if}
					{#if choiceActionResult.choiceError}
						<p class="text-sm text-error-600 dark:text-error-500">{choiceActionResult.choiceError}</p>
					{/if}
					<input type="hidden" name="choice" value={choiceMode ? "true" : "false"} />
						<SlideToggle
							name="choiceModeToggle"
							bind:checked={choiceMode}
							active="bg-primary-500 dark:bg-primary-500"
							on:click={submitChoiceForm}
						>
							{choiceMode ? "More Tutoring Required" : "More Events Required"}
						</SlideToggle>
					<p class="text-xs opacity-80">
						Standard: {calculateRequiredCredits({ ...$currentUser, choice: false, priority: false }, "event")} event /
						{calculateRequiredCredits({ ...$currentUser, choice: false, priority: false }, "tutoring")} tutoring /
						{calculateRequiredCredits({ ...$currentUser, choice: false, priority: false }, "other")} other
					</p>
					<p class="text-xs opacity-80">
						Alternative: {calculateRequiredCredits({ ...$currentUser, choice: true, priority: true }, "event")} event /
						{calculateRequiredCredits({ ...$currentUser, choice: true, priority: true }, "tutoring")} tutoring /
						{calculateRequiredCredits({ ...$currentUser, choice: true, priority: true }, "other")} other
					</p>
					</form>
				{/if}
			<form method="POST" on:submit|preventDefault={handleDeleteAccount} action="?/delete_account">
				<button type="submit" class="btn variant-filled-error">Delete My Account</button>
			</form>
			<br />
			<button type="button" on:click={logout} class="btn variant-outline-primary">Logout</button>
		</section>
		<section>
			<form
				method="POST"
				action="?/change_password"
				class="card p-4 w-full text-token space-y-4"
				use:enhance
			>
				<ErrorComponent errors={$errors} />
				<h3 class="h3">Change password</h3>

				<InputField
					form={formObj}
					field="password"
					label="Enter your current password:"
					type="password"
				/>
				<InputField
					form={formObj}
					field="newPassword"
					label="Enter your new password:"
					type="password"
				/>
				<InputField
					form={formObj}
					field="newPasswordConfirm"
					label="Confirm your new password:"
					type="password"
				/>

				<button type="submit" class="btn variant-filled">Change password</button>
			</form>
		</section>
	{:else}
		<h2 class="h2">You must be logged in to view this page.</h2>
	{/if}
</main>
