<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import type { PageData } from './$types';

	export let data: PageData;

	let selectedInsuranceId: number = 0;
	$: selectedInsuranceData = data.insurances.find(
		(insurance) => insurance.id == selectedInsuranceId
	);

	// Superforms forms
	const {
		form: createInsuranceForm,
		constraints: createInsuranceFormConstraints,
		message: createInsuranceFormMessage,
		enhance: createInsuranceFormEnhance
	} = superForm(data.createInsuranceForm, { id: 'createInsuranceForm' });

	const {
		form: updateInsuranceForm,
		constraints: updateInsuranceFormConstraints,
		message: updateInsuranceFormMessage,
		enhance: updateInsuranceFormEnhance
	} = superForm(data.updateInsuranceForm, { id: 'updateInsuranceForm' });
</script>

<h2 class="h2 text-tertiary-500">Add New Insurance</h2>
<form
	action="?/createInsurance"
	method="post"
	id="createInsuranceForm"
	class="space-y-4"
	use:createInsuranceFormEnhance
>
	<label class="label">
		<span class="text-tertiary-500">Insurance Name</span>
		<input type="text" name="name" class="input" {...$createInsuranceFormConstraints.name} />
	</label>
	<label class="label">
		<span class="text-tertiary-500">Notes</span>
		<textarea name="note" class="textarea" {...$createInsuranceFormConstraints.note}></textarea>
	</label>
	<button type="submit" class="variant-filled-primary btn">Add Insurance</button>
	{#if $createInsuranceFormMessage}
		<div class="variant-filled-success">{$createInsuranceFormMessage}</div>
	{/if}
</form>

<hr />

<h2 class="h2 text-tertiary-500">Update Insurance</h2>
<form
	action="?/updateInsurance"
	method="post"
	id="updateInsuranceForm"
	class="space-y-4"
	use:updateInsuranceFormEnhance
>
	<label class="label">
		<span class="text-tertiary-500">Insurance Select</span>
		<select class="select" name="id" bind:value={selectedInsuranceId}>
			{#each data.insurances as insurance}
				<option value={insurance.id}>{insurance.name}</option>
			{/each}
		</select>
	</label>
	{#if selectedInsuranceId > 0}
		<label class="label">
			<span class="text-tertiary-500">Insurance Name</span>
			<input
				type="text"
				name="name"
				class="input"
				value={selectedInsuranceData.name}
				{...$updateInsuranceFormConstraints.name}
			/>
		</label>
		<label class="label">
			<span class="text-tertiary-500">Notes</span>
			<textarea
				name="note"
				class="textarea"
				value={selectedInsuranceData.note}
				{...$updateInsuranceFormConstraints.note}
			></textarea>
		</label>
		<button type="submit" class="variant-filled-primary btn">Update Insurance</button>
		{#if $updateInsuranceFormMessage}
			<div class="variant-filled-success">{$updateInsuranceFormMessage}</div>
		{/if}
	{/if}
</form>
