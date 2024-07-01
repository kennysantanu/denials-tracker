<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import type { PageData } from './$types';

	export let data: PageData;

	// SuperForm forms
	const {
		form: newLabelForm,
		enhance: newLabelFormEnhance,
		constraints: newLabelFormConstraints
	} = superForm(data.newLabelForm);

	const {
		form: editLabelForm,
		enhance: editLabelFormEnhance,
		constraints: editLabelFormConstraints
	} = superForm(data.editLabelForm);

	const {
		form: deleteLabelForm,
		enhance: deleteLabelFormEnhance,
		constraints: deleteLabelFormConstraints
	} = superForm(data.deleteLabelForm, {
		onSubmit({ formData, cancel }) {
			const labelName = data.labels.find((label) => label.id == formData.get('id'));
			if (
				!confirm(
					`Do you really want to remove ${labelName.label_name}?\nThis will erase all associated labels in denial records.\nPlease note, this operation is irreversible!`
				)
			) {
				cancel();
			}
		}
	});
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

<form action="?/createLabel" method="post" class="space-y-4" use:newLabelFormEnhance>
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

<hr />

<h2 class="h2 text-tertiary-500">Edit Label</h2>
<form action="?/updateLabel" method="post" class="space-y-4" use:editLabelFormEnhance>
	<label class="label">
		<span class="text-tertiary-500">Label Select</span>
		<select
			class="select"
			name="id"
			bind:value={$editLabelForm.id}
			{...$editLabelFormConstraints.id}
		>
			{#each data.labels as label}
				<option value={label.id}>{label.label_name}</option>
			{/each}
		</select>
	</label>
	<label class="label">
		<span class="text-tertiary-500">Label Name</span>
		<input
			type="text"
			name="label_name"
			class="input"
			bind:value={$editLabelForm.label_name}
			{...$editLabelFormConstraints.label_name}
		/>
	</label>
	<label class="label">
		<span class="text-tertiary-500">Label Color</span>
		<input
			type="color"
			name="bg_color"
			bind:value={$editLabelForm.bg_color}
			{...$editLabelFormConstraints.bg_color}
		/>
	</label>
	<label class="label">
		<span class="text-tertiary-500">Text Color</span>
		<input
			type="color"
			name="txt_color"
			bind:value={$editLabelForm.txt_color}
			{...$editLabelFormConstraints.txt_color}
		/>
	</label>
	<div class="space-x-4">
		<button type="submit" class="variant-filled-primary btn">Update Label</button>
	</div>
</form>

<hr />

<h2 class="h2 text-tertiary-500">Delete Label</h2>
<form action="?/deleteLabel" method="post" class="space-y-4" use:deleteLabelFormEnhance>
	<label class="label">
		<span class="text-tertiary-500">Label Select</span>
		<select
			class="select"
			name="id"
			bind:value={$deleteLabelForm.id}
			{...$deleteLabelFormConstraints.id}
		>
			{#each data.labels as label}
				<option value={label.id}>{label.label_name}</option>
				>
			{/each}
		</select>
	</label>
	<div class="space-x-4">
		<button type="submit" class="variant-filled-primary btn">Delete Label</button>
	</div>
</form>
