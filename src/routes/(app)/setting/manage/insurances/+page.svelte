<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import type { PageData } from './$types';

	export let data: PageData;

	// Superforms forms
	const {
		form: createInsuranceForm,
		constraints: createInsuranceFormConstraints,
		message: createInsuranceFormMessage,
		enhance: createInsuranceFormEnhance
	} = superForm(data.createInsuranceForm, { id: 'createInsuranceForm' });
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
