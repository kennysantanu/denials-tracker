<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { enhance } from '$app/forms';
	import Ellipsis from '$lib/icons/Ellipsis-vertical.svelte';
	import Pencil from '$lib/icons/Pencil-square.svelte';

	// Type definitions
	type DenialsData = {
		id: number;
		created_at: string;
		patient_id: number;
		service_start_date: string;
		service_end_date: string;
		billed_amount: number;
		paid_amount: number;
		notes: {
			id: number;
			created_at: string;
			modified_at: string | null;
			note: string;
			users: {
				username: string;
			};
		}[];
		labels: {
			id: number;
			order: number;
			label_name: string;
			bg_color: string;
			txt_color: string;
		}[];
	}[];

	// Variables
	export let data;
	$: patientList = data.patients;
	let selectedPatientId: string = '';
	let selectedPatientData = null;
	let denialsData: DenialsData = [];
	let denialsDataLength = 0;
	$: selectedPatientData = patientList.find((patient) => patient.id === selectedPatientId);
	let showAddNewPatientForm: boolean = false;
	let showAddNewDenialForm: boolean = false;
	let showAddNewNoteForm: boolean = false;
	let editPatientNote: boolean = false;

	// SuperForm forms
	const {
		form: newPatientForm,
		errors: newPatientFormErrors,
		constraints: newPatientFormConstraints,
		enhance: newPatientFormEnhance
	} = superForm(data.newPatientForm, {
		onUpdated() {
			alert('New patient added successfully!');
			reloadPage();
		}
	});

	const {
		form: newDenialForm,
		errors: newDenialFormErrors,
		constraints: newDenialFormConstraints,
		enhance: newDenialFormEnhance
	} = superForm(data.newDenialForm, {
		onUpdated() {
			alert('New denial added successfully!');
			showAddNewDenialForm = !showAddNewDenialForm;
			getDenials(selectedPatientId);
		}
	});

	const {
		form: newNoteForm,
		errors: newNoteFormErrors,
		constraints: newNoteFormConstraints,
		enhance: newNoteFormEnhance
	} = superForm(data.newNoteForm, {
		onUpdated() {
			alert('New note added successfully!');
			showAddNewNoteForm = !showAddNewNoteForm;
			getDenials(selectedPatientId);
		}
	});

	// Functions
	const getDenials = async (patient_id: string): Promise<void> => {
		const response = await fetch(`/api/v1/denials?patientid=${patient_id}`);
		denialsData = await response.json();
		denialsDataLength = denialsData.length;
	};

	const formatDate = (date: String): String => {
		const dateString = date.toString();
		const formattedDate = `${dateString.substring(5, 7)}/${dateString.substring(8, 10)}/${dateString.substring(0, 4)}`;
		return formattedDate;
	};

	const reloadPage = (): void => {
		location.reload();
	};
</script>

<!-- Patient Card -->
<div class="card m-2 w-full space-y-12 p-8">
	<label class="label">
		<span class="text-tertiary-500">Patient Select</span>
		<div class="flex flex-row space-x-8">
			<select
				class="select"
				bind:value={selectedPatientId}
				on:change={async () => await getDenials(selectedPatientId)}
			>
				<option value="" disabled selected>Select a patient</option>
				{#each patientList as patient}
					<option value={patient.id}
						>{patient.last_name}, {patient.first_name} ({formatDate(patient.date_of_birth)})</option
					>
				{/each}
			</select>

			<button
				type="button"
				class="variant-filled-secondary btn"
				on:click={() => (showAddNewPatientForm = !showAddNewPatientForm)}
				disabled={showAddNewPatientForm || !data.session}>Add New Patient</button
			>
		</div>
	</label>

	{#if showAddNewPatientForm}
		<div class="card space-y-6 p-6">
			<h3 class="h3 text-tertiary-500">Create New Patient</h3>
			<form method="POST" action="?/addNewPatient" class="space-y-6" use:newPatientFormEnhance>
				<label class="label">
					<span class="text-tertiary-500">Last Name</span>
					<input
						class="input"
						type="text"
						name="last_name"
						placeholder="Enter last name"
						aria-invalid={$newPatientFormErrors.last_name ? 'true' : undefined}
						bind:value={$newPatientForm.last_name}
						{...$newPatientFormConstraints.last_name}
					/>
				</label>
				<label class="label">
					<span class="text-tertiary-500">First Name</span>
					<input
						class="input"
						type="text"
						name="first_name"
						placeholder="Enter first name"
						aria-invalid={$newPatientFormErrors.first_name ? 'true' : undefined}
						bind:value={$newPatientForm.first_name}
						{...$newPatientFormConstraints.first_name}
					/>
				</label>
				<label class="label">
					<span class="text-tertiary-500">Date of Birth</span>
					<input
						class="input"
						name="date_of_birth"
						type="date"
						aria-invalid={$newPatientFormErrors.date_of_birth ? 'true' : undefined}
						bind:value={$newPatientForm.date_of_birth}
						{...$newPatientFormConstraints.date_of_birth}
					/>
				</label>
				<div class="space-x-4">
					<button type="submit" class="variant-filled-primary btn">Save</button>
					<button
						type="button"
						class="variant-filled-secondary btn"
						on:click={() => (showAddNewPatientForm = !showAddNewPatientForm)}>Cancel</button
					>
				</div>
			</form>
		</div>
	{/if}

	<!-- Patient's note -->
	{#if selectedPatientId}
		{#if editPatientNote}
			<form
				action="?/updatePatientNote"
				method="post"
				class="space-y-4"
				use:enhance={() => {
					return async ({ update }) => {
						editPatientNote = !editPatientNote;
						await update();
					};
				}}
			>
				<input hidden name="patient_id" value={selectedPatientId} />
				<label class="label">
					<span class="text-tertiary-500">Note</span>
					<textarea class="textarea grow" name="note" rows="4" value={selectedPatientData.note} />
				</label>
				<div class="space-x-4">
					<button type="submit" class="variant-filled-primary btn">Save</button>
					<button
						type="button"
						class="variant-filled-secondary btn"
						on:click={() => (editPatientNote = !editPatientNote)}>Cancel</button
					>
				</div>
			</form>
		{:else}
			<div class="flex flex-nowrap space-x-4">
				<div class="label grow">
					<span class="text-tertiary-500">Note</span>
					<p class="card p-2">
						{selectedPatientData.note}
					</p>
				</div>

				<button
					type="button"
					class="btn-icon text-tertiary-500"
					on:click={() => (editPatientNote = !editPatientNote)}
				>
					<Pencil />
				</button>
			</div>
		{/if}
	{/if}
</div>

<!-- Denial List -->
{#if selectedPatientId}
	<div class="m-2 space-y-8">
		<!-- Denial List Header -->
		<div class="flex flex-row items-end justify-between">
			<p class="font-bold">
				Denial Records for {selectedPatientData.last_name}, {selectedPatientData.first_name} ({denialsDataLength}
				in total)
			</p>
			<button
				type="button"
				class="btn font-bold text-tertiary-500"
				on:click={() => (showAddNewDenialForm = !showAddNewDenialForm)}
				disabled={showAddNewDenialForm || !data.session}>+ Add New Record</button
			>
		</div>
		{#if showAddNewDenialForm}
			<form method="POST" action="?/createDenial" use:newDenialFormEnhance>
				<div class="card space-y-6 p-6">
					<h3 class="h3 text-tertiary-500">Create New Denial</h3>
					<div class="space-y-6">
						<input type="hidden" name="patient_id" value={selectedPatientData.id} />
						<div class="grid-row grid grid-cols-2 gap-6">
							<label class="label">
								<span class="text-tertiary-500">From</span>
								<input
									class="input"
									type="date"
									name="service_start_date"
									aria-invalid={$newDenialFormErrors.service_start_date ? 'true' : undefined}
									bind:value={$newDenialForm.service_start_date}
									{...$newDenialFormConstraints.service_start_date}
								/>
							</label>
							<label class="label">
								<span class="text-tertiary-500">To (optional)</span>
								<input
									class="input"
									type="date"
									name="service_end_date"
									aria-invalid={$newDenialFormErrors.service_end_date ? 'true' : undefined}
									bind:value={$newDenialForm.service_end_date}
									{...$newDenialFormConstraints.service_end_date}
								/>
							</label>
							<label class="label">
								<span class="text-tertiary-500">Bill Amount</span>
								<input
									class="input"
									type="number"
									name="billed_amount"
									aria-invalid={$newDenialFormErrors.billed_amount ? 'true' : undefined}
									bind:value={$newDenialForm.billed_amount}
									{...$newDenialFormConstraints.billed_amount}
									step="0.01"
								/>
							</label>
							<label class="label">
								<span class="text-tertiary-500">Paid Amount</span>
								<input
									class="input"
									type="number"
									name="paid_amount"
									aria-invalid={$newDenialFormErrors.paid_amount ? 'true' : undefined}
									bind:value={$newDenialForm.paid_amount}
									{...$newDenialFormConstraints.paid_amount}
									step="0.01"
								/>
							</label>
						</div>
						<label class="label">
							<span class="text-tertiary-500">Labels</span>
							<select
								class="select"
								name="label_id"
								multiple
								aria-invalid={$newDenialFormErrors.label_id ? 'true' : undefined}
								bind:value={$newDenialForm.label_id}
								{...$newDenialFormConstraints.label_id}
							>
								{#each data.labels as label}
									<option value={label.id}>{label.label_name}</option>
								{/each}
							</select>
						</label>
					</div>
					<div class="space-x-4">
						<button type="submit" class="variant-filled-primary btn">Save</button>
						<button
							type="button"
							class="variant-filled-secondary btn"
							on:click={() => (showAddNewDenialForm = !showAddNewDenialForm)}>Cancel</button
						>
					</div>
				</div>
			</form>
		{/if}

		<!-- Denial List Cards -->
		{#if denialsData && denialsDataLength > 0}
			{#each denialsData as denialData}
				<div class="card space-y-8 p-8">
					<!-- Denial List Card Header -->
					<div class="flex justify-between">
						<div class="flex grow flex-wrap gap-4">
							<div class="grow">
								<div class="grid min-w-48 grid-rows-2">
									<span class="text-slate-500">Date of Service</span>
									{formatDate(denialData.service_start_date)}
									{#if denialData.service_end_date}
										- {formatDate(denialData.service_end_date)}
									{/if}
								</div>
							</div>
							<div class="grow">
								<div class="grid grid-rows-2">
									<span class="text-slate-500">Bill Amount</span>
									${denialData.billed_amount}
								</div>
							</div>
							<div class="grow">
								<div class="grid grid-rows-2">
									<span class="text-slate-500">Paid Amount</span>
									${denialData.paid_amount}
								</div>
							</div>
							<div class="grow">
								<span class="text-slate-500">Labels</span>
								{#if denialData.labels.length > 0}
									<div class="flex flex-row flex-wrap space-x-2">
										{#each denialData.labels as label}
											<span
												class="variant-filled chip"
												style="background-color: {label.bg_color}; color: {label.txt_color};"
												>{label.label_name}</span
											>
										{/each}
									</div>
								{/if}
							</div>
						</div>
						<div>
							<button type="button" class="btn-icon text-tertiary-500">
								<Ellipsis />
							</button>
						</div>
					</div>
					<hr />
					<button
						type="button"
						class="btn text-tertiary-500"
						on:click={() => (showAddNewNoteForm = !showAddNewNoteForm)}
						disabled={showAddNewNoteForm || !data.session}>+ Add New Note</button
					>

					<!-- Add New Note Form -->
					{#if showAddNewNoteForm}
						<form method="POST" action="?/createNote" use:newNoteFormEnhance>
							<div class="card space-y-6 p-6">
								<h3 class="h3 text-tertiary-500">Create New Note</h3>
								<input type="hidden" name="denial_id" value={denialData.id} />
								<label class="label">
									<span class="text-tertiary-500">Note</span>
									<textarea
										class="textarea"
										rows="4"
										name="note"
										aria-invalid={$newNoteFormErrors.note ? 'true' : undefined}
										bind:value={$newNoteForm.note}
										{...$newNoteFormConstraints.note}
									/>
								</label>
								<div class="space-x-4">
									<button type="submit" class="variant-filled-primary btn">Save</button>
									<button
										type="button"
										class="variant-filled-secondary btn"
										on:click={() => (showAddNewNoteForm = !showAddNewNoteForm)}>Cancel</button
									>
								</div>
							</div>
						</form>
					{/if}
					{#if denialData.notes.length > 0}
						{#each denialData.notes as noteData}
							<div class="flex flex-row">
								<div>
									<span>({formatDate(noteData.created_at)})</span>
									<span class="font-bold">{noteData.users.username}:</span>
									<span class="text-surface-800">{noteData.note}</span>
								</div>
								<div>
									<button type="button" class="btn-icon text-surface-800">
										<Ellipsis />
									</button>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			{/each}
		{/if}
	</div>
{/if}
