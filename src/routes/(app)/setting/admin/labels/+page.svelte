<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import type { PageData } from './$types';

	export let data: PageData;

	// SuperForm forms
	const { form: newLabelForm, constraints: newLabelFormConstraints } = superForm(data.newLabelForm);
</script>

<h2 class="h2 text-tertiary-500">List of Labels</h2>
<ul class="space-x-4 space-y-4">
	{#each data.labels as label}
		<span
			class="variant-filled chip"
			style="background-color: {label.bg_color}; color: {label.txt_color};">{label.label_name}</span
		>
	{/each}
</ul>

<hr />

<form action="?/createLabel" method="post" class="space-y-4">
	<h2 class="h2 text-tertiary-500">Create New Label</h2>
	<label class="label">
		<span class="text-tertiary-500">Label Name</span>
		<input
			type="text"
			name="label_name"
			class="input"
			bind:value={$newLabelForm.label_name}
			{...$newLabelFormConstraints.label_name}
		/>
	</label>
	<label class="label">
		<span class="text-tertiary-500">Label Color</span>
		<input
			type="color"
			name="bg_color"
			bind:value={$newLabelForm.bg_color}
			{...$newLabelFormConstraints.bg_color}
		/>
	</label>
	<label class="label">
		<span class="text-tertiary-500">Text Color</span>
		<input
			type="color"
			name="txt_color"
			bind:value={$newLabelForm.txt_color}
			{...$newLabelFormConstraints.txt_color}
		/>
	</label>
	<div class="space-x-4">
		<button type="submit" class="variant-filled-primary btn">Create Label</button>
	</div>
</form>
