<!-- https://superforms.rocks/components#using-the-componentized-field-in-awesome-ways -->
<script lang="ts" generics="T extends Record<string, unknown>">
	import { untrack } from "svelte";
	import {
		formFieldProxy,
		type FormFieldProxy,
		type SuperForm,
		type FormPathLeaves
	} from "sveltekit-superforms";

	interface Props {
		form: SuperForm<T, any>;
		field: FormPathLeaves<T>;
		label?: string;
		hint?: string;
		/** Show the hint as a nudge to change what's typed, not just help text. */
		hintIsNudge?: boolean;
		placeholder?: string;
		type?: string;
		inputmode?: "email" | "search" | "text" | "none" | "tel" | "url" | "numeric" | "decimal";
		[key: string]: any;
	}

	let {
		form,
		field,
		label = "",
		hint = "",
		hintIsNudge = false,
		placeholder = "",
		type = "text",
		inputmode = "text",
		...rest
	}: Props = $props();

	const { value, errors, constraints } = formFieldProxy(
		untrack(() => form),
		untrack(() => field)
	) satisfies FormFieldProxy<string>;

	const uid = $props.id();
	const id = `field-${String(untrack(() => field))}-${uid}`;
	// The email pattern the form library generates doesn't compile in current
	// browsers; type="email" already checks the format, and the server validates.
	const fieldConstraints = $derived(
		type === "email" ? { ...$constraints, pattern: undefined } : $constraints
	);
</script>

<div class="field">
	<label for={id}>{label || field}</label>
	<input
		{id}
		class="input"
		name={field}
		{...{ type }}
		{inputmode}
		aria-invalid={$errors ? "true" : undefined}
		aria-describedby={[hint ? `${id}-hint` : "", $errors ? `${id}-error` : ""]
			.filter(Boolean)
			.join(" ") || undefined}
		bind:value={$value}
		{placeholder}
		{...fieldConstraints}
		{...rest}
	/>
	{#if $errors}
		<span class="field-error" id="{id}-error">{$errors}</span>
	{:else if hint}
		<span
			class="field-hint"
			class:input-field__nudge={hintIsNudge}
			id="{id}-hint"
			aria-live="polite">{hint}</span
		>
	{/if}
</div>

<style>
	.field {
		display: grid;
		align-content: start;
		gap: 0.4rem;
	}
	label {
		color: var(--ink);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	input[aria-invalid="true"] {
		border-color: var(--danger) !important;
	}
	.field-error {
		margin-top: 0;
	}
	.input-field__nudge {
		color: var(--warning);
		font-weight: 500;
	}
</style>
