<script lang="ts">
	import { superForm } from "sveltekit-superforms";
	import type { PageData } from "./$types";
	import ErrorComponent from "$lib/components/ErrorComponent.svelte";
	import InputField from "$lib/components/InputField.svelte";
	import { SlideToggle } from "@skeletonlabs/skeleton";
	import SuperDebug from "sveltekit-superforms";
	import { page } from "$app/stores";

	let message: string;
	$: message = $page.url.searchParams.get("message") ?? "";

	export let data: PageData;
	const formObj = superForm(data.form);
	const { form, errors, constraints } = formObj;
</script>

<main class="container mx-auto p-8 space-y-8">
	<!-- <SuperDebug data={{ $form, $errors }} /> -->

	<hgroup>
		<h1 class="h1">Register</h1>
		<p>Register to ARISTA with your Stuy.edu email!</p>
	</hgroup>

	{#if message}
		<aside class="alert variant-filled-warning mb-4">
			<b>{message}</b>
		</aside>
	{/if}

	<ErrorComponent errors={$errors} />

	<form method="POST" class="card p-4 w-full text-token space-y-4">
		<InputField form={formObj} field="name" label="Enter your name:" placeholder="John Doe" />

		<!-- <label for="is_tutee">
			Please select whether you are looking to be tutored <b>or</b> are an active ARISTA member.
			<br />
			<SlideToggle
				name="is_tutee"
				bind:checked={$form.is_tutee}
				active="bg-primary-500 dark:bg-primary-500"
				{...$constraints.is_tutee}
			>
				{$form.is_tutee
					? "I'm not an ARISTA member and I'm here to be tutored."
					: "I am an accepted ARISTA member."}
			</SlideToggle>
		</label> -->

		<InputField form={formObj} field="homeroom" label="Enter your homeroom:" placeholder="3JJ" />
		<InputField
			form={formObj}
			field="graduationYear"
			label="Enter your graduation year:"
			inputmode="numeric"
			placeholder={String(new Date().getFullYear() + 3)}
		/>
		<InputField
			form={formObj}
			field="osis"
			label="Enter your osis:"
			inputmode="numeric"
			placeholder="123456789"
		/>

		<InputField
			form={formObj}
			field="email"
			label="Enter your email (@stuy.edu):"
			placeholder="email@stuy.edu"
			type="email"
		/>

		<InputField
			form={formObj}
			field="password"
			label="Enter a strong password:"
			placeholder="a_long_and_secure_password"
			type="password"
		/>

		<InputField
			form={formObj}
			field="passwordConfirm"
			label="Enter the password again:"
			type="password"
		/>

		<input type="submit" class="btn variant-filled" value="Register" />
		<p id="suggest_login">
			Already have an account? <a href="/login" class="anchor">Login here.</a>
		</p>
	</form>
</main>
