<script lang="ts">
	import { untrack } from "svelte";
	import { EventSchema } from "$lib/db_types";
	import { SlideToggle } from "$lib/skeleton-compat";
	import type { Infer } from "sveltekit-superforms";
	import ErrorComponent from "$lib/components/ErrorComponent.svelte";
	import InputField from "$lib/components/InputField.svelte";
	import type { SuperForm } from "sveltekit-superforms/client";

	interface Props {
		promptText?: "Update" | "Create";
		formObj: SuperForm<Infer<typeof EventSchema>>;
	}

	let { promptText = "Create", formObj }: Props = $props();
	const { form, errors, constraints, message } = untrack(() => formObj);

	function toDateTimeLocalValue(value: Date | string | null | undefined) {
		if (!value) return "";
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) return "";
		const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
		return localDate.toISOString().slice(0, 16);
	}

	// The picker gives a wall-clock time with no zone. Convert it to an exact
	// instant here, in the member's browser, so the server (which runs in UTC)
	// doesn't read 9:30 AM New York time as 9:30 AM UTC.
	function setTime(field: "start_time" | "end_time", value: string) {
		const date = new Date(value);
		if (!Number.isNaN(date.getTime())) $form[field] = date;
	}

	function toIsoValue(value: Date | string | null | undefined) {
		if (!value) return "";
		const date = value instanceof Date ? value : new Date(value);
		return Number.isNaN(date.getTime()) ? "" : date.toISOString();
	}
</script>

<ErrorComponent errors={$errors} />

<div class="editor">
	<div class="editor__wide">
		<InputField
			form={formObj}
			field="name"
			label="Event name"
			placeholder="Blood drive, PS 100 fall festival"
		/>
	</div>
	<InputField
		form={formObj}
		field="location"
		label="Location"
		placeholder="Stuyvesant cafeteria, Prospect Park"
	/>
	<div class="editor__field">
		<label for="place">Borough or area</label>
		<select id="place" name="place" bind:value={$form.place}>
			<option value="" disabled selected>Choose one</option>
			<option value="In Stuy">In Stuy</option>
			<option value="Queens">Queens</option>
			<option value="Manhattan">Manhattan</option>
			<option value="Brooklyn">Brooklyn</option>
			<option value="Bronx">Bronx</option>
			<option value="Staten Island">Staten Island</option>
			<option value="Other">Other</option>
		</select>
	</div>
	<div class="editor__wide">
		<div class="field">
			<label for="event-description">What will volunteers do?</label>
			<textarea
				id="event-description"
				class="input editor__description"
				name="description"
				rows="4"
				placeholder="What the work is, what to bring, and who to find when you arrive."
				aria-invalid={$errors.description ? "true" : undefined}
				bind:value={$form.description}
				{...$constraints.description}></textarea>
			{#if $errors.description}<span class="field-error">{$errors.description}</span>{/if}
		</div>
	</div>
	<InputField
		form={formObj}
		field="intendedVolunteers"
		label="Volunteers needed"
		placeholder="10"
		inputmode="numeric"
	/>
	<InputField form={formObj} field="multiplier" label="Credit multiplier" inputmode="numeric" />
	<div class="editor__field">
		<input type="hidden" name="start_time" value={toIsoValue($form.start_time)} />
		<label for="start_time">Starts</label>
		<input
			id="start_time"
			type="datetime-local"
			value={toDateTimeLocalValue($form.start_time)}
			oninput={(e) => setTime("start_time", e.currentTarget.value)}
			max="2029-01-01T00:00"
		/>
	</div>
	<div class="editor__field">
		<input type="hidden" name="end_time" value={toIsoValue($form.end_time)} />
		<label for="end_time">Ends</label>
		<input
			id="end_time"
			type="datetime-local"
			value={toDateTimeLocalValue($form.end_time)}
			oninput={(e) => setTime("end_time", e.currentTarget.value)}
			max="2029-01-01T00:00"
			aria-invalid={$errors.end_time ? "true" : undefined}
		/>
		{#if $errors.end_time}<span class="invalid">{$errors.end_time}</span>{/if}
	</div>
	<div class="editor__toggle editor__wide">
		<div>
			<strong>Close sign-ups</strong>
			<p>The event shows as closed. Members can still add themselves if you've asked them to.</p>
		</div>
		<SlideToggle
			name="signupStatus"
			bind:checked={$form.signupStatus}
			{...$constraints.signupStatus}
		/>
	</div>
	<div class="editor__wide">
		<button class="btn btn-primary btn-lg" type="submit"
			>{promptText === "Create" ? "Create event" : "Save changes"}</button
		>
	</div>
</div>

<style>
	.field {
		display: grid;
		gap: 0.4rem;
	}
	.field label {
		font-size: var(--text-sm);
		font-weight: 600;
	}
	/* Grows with the text where supported; otherwise drag to resize. */
	.editor__description {
		min-height: 7rem;
		resize: vertical;
		field-sizing: content;
		line-height: 1.55;
	}
	.editor {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.1rem;
	}
	.editor__wide {
		grid-column: 1 / -1;
	}
	.editor__field {
		display: grid;
		align-content: start;
		gap: 0.4rem;
	}
	.editor__field label {
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.editor__toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.1rem;
		border-radius: var(--radius-field);
		background: var(--surface-sunken);
	}
	.editor__toggle strong {
		font-weight: 650;
	}
	.editor__toggle p {
		margin: 0.15rem 0 0;
		color: var(--muted);
		font-size: var(--text-sm);
	}
	@media (max-width: 640px) {
		.editor {
			grid-template-columns: 1fr;
		}
		.editor .btn {
			width: 100%;
		}
	}
</style>
