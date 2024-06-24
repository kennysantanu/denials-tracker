<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import Ellipsis from '$lib/icons/Ellipsis-vertical.svelte';

	// Variables
	export let data;
	let patientList = data.patients;
	let selectedPatientId: String = '';
	let selectedPatientData = null;
	$: selectedPatientData = patientList.find((patient) => patient.id === selectedPatientId);
	let showAddNewPatientForm: boolean = false;
	let showAddNewDenialForm: boolean = false;

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
		}
	});

	// Functions
	const formatDate = (date: Date): String => {
		const dateString = date.toString();
		const formattedDate = `${dateString.substring(5, 7)}/${dateString.substring(8, 10)}/${dateString.substring(0, 4)}`;
		return formattedDate;
	};

	const reloadPage = (): void => {
		location.reload();
	};
</script>

<!-- Patient Card -->
<div class="card w-full space-y-12 p-8">
	<label class="label">
		<span class="text-tertiary-500">Patient Select</span>
		<div class="flex flex-row space-x-8">
			<select class="select" bind:value={selectedPatientId}>
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

	{#if selectedPatientId}
		<label class="label">
			<span class="text-tertiary-500">Note</span>
			<div class="flex flex-row space-x-4">
				<textarea class="textarea" rows="4" />
				<div>
					<button type="button" class="btn-icon text-tertiary-500">
						<Ellipsis />
					</button>
				</div>
			</div>
		</label>
	{/if}
</div>

<!-- Denial List -->
{#if selectedPatientId}
	<div class="space-y-8">
		<!-- Denial List Header -->
		<div class="flex flex-row items-end justify-between">
			<p class="font-bold">
				Denial Records for {selectedPatientData.last_name}, {selectedPatientData.first_name} (x in total)
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
					<div class="flex flex-wrap justify-between">
						<input type="hidden" name="patient_id" value={selectedPatientData.id} />
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
		<div class="card space-y-8 px-8 py-8">
			<!-- Denial List Card Header -->
			<div class="flex flex-wrap justify-between">
				<div class="grid grid-rows-2">
					<span class="text-slate-500">Date of Service</span>
					01/01/2021 - 01/31/2021
				</div>
				<div class="grid grid-rows-2">
					<span class="text-slate-500">Bill Amount</span>
					$750.00
				</div>
				<div class="grid grid-rows-2">
					<span class="text-slate-500">Paid Amount</span>
					$420.69
				</div>
				<div class="grid grid-rows-2">
					<span class="text-slate-500">Labels</span>
					<div>
						<span class="variant-filled-success chip">Paid</span>
						<span class="variant-filled-warning chip">Appealed</span>
						<span class="variant-filled-error chip">Denied</span>
					</div>
				</div>
				<div>
					<button type="button" class="btn-icon text-tertiary-500">
						<Ellipsis />
					</button>
				</div>
			</div>
			<hr />
			<button type="button" class="btn text-tertiary-500">+ Add New Note</button>
			<div class="flex flex-row">
				<div>
					<span>(04/01/2024)</span>
					<span class="font-bold">username:</span>
					<span class="text-surface-800"
						>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean convallis lorem sed
						nulla tristique eleifend. Mauris lacinia dapibus magna, ut bibendum ex scelerisque eu.
						Sed a fermentum nulla. Nullam molestie erat non mauris mattis euismod. Mauris nec dolor
						ac ipsum viverra egestas sed ut risus. Nullam rhoncus dictum massa, vel condimentum
						risus scelerisque sed. Aliquam non orci sem. Nunc eget rhoncus est.</span
					>
				</div>
				<div>
					<button type="button" class="btn-icon text-surface-800">
						<Ellipsis />
					</button>
				</div>
			</div>
			<div class="flex flex-row">
				<div>
					<span>(04/01/2024)</span>
					<span class="font-bold">username:</span>
					<span class="text-surface-800"
						>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque
						laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi
						architecto beatae vitae dicta sunt explicabo.</span
					>
				</div>
				<div>
					<button type="button" class="btn-icon text-surface-800">
						<Ellipsis />
					</button>
				</div>
			</div>
			<div class="flex flex-row">
				<div>
					<span>(04/01/2024)</span>
					<span class="font-bold">username:</span>
					<span class="text-surface-800"
						>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia
						consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro
						quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed
						quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat
						voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis
						suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure
						reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum
						qui dolorem eum fugiat quo voluptas nulla pariatur?</span
					>
				</div>
				<div>
					<button type="button" class="btn-icon text-surface-800">
						<Ellipsis />
					</button>
				</div>
			</div>
		</div>

		<!-- Denial List Cards 2 -->
		<div class="card space-y-8 px-8 py-8">
			<!-- Denial List Card Header -->
			<div class="flex flex-wrap justify-between">
				<div class="grid grid-rows-2">
					<span class="text-slate-500">Date of Service</span>
					01/01/2020
				</div>
				<div class="grid grid-rows-2">
					<span class="text-slate-500">Bill Amount</span>
					$250.00
				</div>
				<div class="grid grid-rows-2">
					<span class="text-slate-500">Paid Amount</span>
					$$0.00
				</div>
				<div class="grid grid-rows-2">
					<span class="text-slate-500">Labels</span>
					<div>
						<span class="variant-filled-error chip">Denied</span>
					</div>
				</div>
				<div>
					<button type="button" class="btn-icon text-tertiary-500">
						<Ellipsis />
					</button>
				</div>
			</div>
			<hr />
			<button type="button" class="btn text-tertiary-500">+ Add New Note</button>
			<div class="flex flex-row">
				<div>
					<span>(04/01/2024)</span>
					<span class="font-bold">username:</span>
					<span class="text-surface-800"
						>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean convallis lorem sed
						nulla tristique eleifend. Mauris lacinia dapibus magna, ut bibendum ex scelerisque eu.
						Sed a fermentum nulla. Nullam molestie erat non mauris mattis euismod. Mauris nec dolor
						ac ipsum viverra egestas sed ut risus. Nullam rhoncus dictum massa, vel condimentum
						risus scelerisque sed. Aliquam non orci sem. Nunc eget rhoncus est.</span
					>
				</div>
				<div>
					<button type="button" class="btn-icon text-surface-800">
						<Ellipsis />
					</button>
				</div>
			</div>
			<div class="flex flex-row">
				<div>
					<span>(04/01/2024)</span>
					<span class="font-bold">username:</span>
					<span class="text-surface-800"
						>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque
						laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi
						architecto beatae vitae dicta sunt explicabo.</span
					>
				</div>
				<div>
					<button type="button" class="btn-icon text-surface-800">
						<Ellipsis />
					</button>
				</div>
			</div>
			<div class="flex flex-row">
				<div>
					<span>(04/01/2024)</span>
					<span class="font-bold">username:</span>
					<span class="text-surface-800"
						>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia
						consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro
						quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed
						quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat
						voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis
						suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure
						reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum
						qui dolorem eum fugiat quo voluptas nulla pariatur?</span
					>
				</div>
				<div>
					<button type="button" class="btn-icon text-surface-800">
						<Ellipsis />
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
