<script lang="ts">
	import { superForm } from "sveltekit-superforms";
	import type { PageData } from "./$types";
	import ErrorComponent from "$lib/components/ErrorComponent.svelte";
	import InputField from "$lib/components/InputField.svelte";
	import { page } from "$app/stores";

	let message: string;
	$: message = $page.url.searchParams.get("message") ?? "";

	export let data: PageData;
	const formObj = superForm(data.form);
	const { form, errors, constraints } = formObj;
</script>

<main class="container mx-auto p-8 space-y-8">
	<hgroup>
		<h1 class="h1">Sign in</h1>
		<p>Sign in to ARISTA with your Stuy.edu email!</p>
	</hgroup>

	{#if message}
		<aside class="alert variant-filled-warning mb-4">
			<b>{message}</b>
		</aside>
	{/if}
	<ErrorComponent errors={$errors} />

	<form method="POST" class="card p-4 w-full text-token space-y-4">
		<InputField
			form={formObj}
			field="email"
			label="Enter your email:"
			placeholder="email@stuy.edu"
			type="email"
		/>

		<InputField form={formObj} field="password" label="Enter your password:" type="password" />

		<input type="submit" class="btn variant-filled" value="Log in" />
		<p id="suggest_register">
			Don't have an account? <a href="/register" class="anchor">Register for one.</a>
		</p>
		<p id="forgot_password">
			<a href="/forgot-password" class="anchor">Forgot your password?</a>
		</p>
	</form>
</main>
