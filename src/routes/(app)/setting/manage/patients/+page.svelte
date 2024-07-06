<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import type { PageData } from './$types';

	export let data: PageData;

	let selectedPatientId: number = 0;
	$: selectedPatientData = data.patients.find((patient) => patient.id == selectedPatientId);

	// SuperForm forms
	const {
		form: updatePatientForm,
		constraints: updatePatientFormConstraints,
		enhance: updatePatientFormEnhance
	} = superForm(data.updatePatientForm, {
		id: 'updatePatientForm',
		onSubmit({}) {
			selectedPatientId = 0;
			alert('Patient updated!');
		}
	});

	const {
		form: deletePatientForm,
		constraints: deletePatientFormConstraints,
		enhance: deletePatientFormEnhance
	} = superForm(data.deletePatientForm, {
		id: 'deletePatientForm',
		onSubmit({ cancel }) {
			if (
				!confirm(
					`Are you sure you wish to delete this patient's record?\nThis action will permanently remove all associated denials and notes for the patient.\nPlease be aware, this operation cannot be undone!`
				)
			) {
				cancel();
			}
		}
	});

	// Function
	const formatDate = (date: String): String => {
		const dateString = date.toString();
		const formattedDate = `${dateString.substring(5, 7)}/${dateString.substring(8, 10)}/${dateString.substring(0, 4)}`;
		return formattedDate;
	};
</script>

<h2 class="h2 text-tertiary-500">Edit Patient</h2>
<label class="label">
	<span class="text-tertiary-500">Patient Select</span>
	<select class="select" name="id" bind:value={selectedPatientId}>
		{#each data.patients as patient}
			<option value={patient.id}
				>{patient.last_name}, {patient.first_name} ({formatDate(patient.date_of_birth)})</option
			>
		{/each}
	</select>
</label>

{#if selectedPatientId > 0}
	<form
		action="?/updatePatient"
		method="post"
		id="updatePatientForm"
		class="space-y-4"
		use:updatePatientFormEnhance
	>
		<input type="hidden" name="id" value={selectedPatientId} />
		<label class="label">
			<span class="text-tertiary-500">Last Name</span>
			<input
				type="text"
				name="last_name"
				class="input"
				value={selectedPatientData.last_name}
				{...$updatePatientFormConstraints.last_name}
			/>
		</label>
		<label class="label">
			<span class="text-tertiary-500">First Name</span>
			<input
				type="text"
				name="first_name"
				class="input"
				value={selectedPatientData.first_name}
				{...$updatePatientFormConstraints.first_name}
			/>
		</label>
		<label class="label">
			<span class="text-tertiary-500">Date of Birth</span>
			<input
				type="date"
				name="date_of_birth"
				class="input"
				value={selectedPatientData.date_of_birth}
				{...$updatePatientFormConstraints.date_of_birth}
			/>
		</label>
		<div class="space-x-4">
			<button type="submit" class="variant-filled-primary btn">Edit Patient</button>
			<button
				type="button"
				class="variant-filled-secondary btn"
				on:click={() => (selectedPatientId = 0)}>Cancel</button
			>
		</div>
	</form>
{/if}

<hr />

<h2 class="h2 text-tertiary-500">Delete Patient</h2>
<form
	action="?/deletePatient"
	method="post"
	id="deletePatientForm"
	class="space-y-4"
	use:deletePatientFormEnhance
>
	<label class="label">
		<span class="text-tertiary-500">Patient Select</span>
		<select class="select" name="id" bind:value={$deletePatientForm.id}>
			{#each data.patients as patient}
				<option value={patient.id}
					>{patient.last_name}, {patient.first_name} ({formatDate(patient.date_of_birth)})</option
				>
			{/each}
		</select>
	</label>
	<button type="submit" class="variant-filled-primary btn">Delete Patient</button>
</form>
