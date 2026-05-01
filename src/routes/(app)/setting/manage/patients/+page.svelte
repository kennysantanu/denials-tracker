<script lang="ts">
	import { enhance } from '$app/forms';
	import { toastSuccess, toastError } from '$lib/toast';

	let { data } = $props();

	let showAddForm = $state(false);
	let editingId = $state<number | null>(null);
	let editFirst = $state('');
	let editLast = $state('');
	let editDob = $state('');
	let editNote = $state('');

	function startEdit(patient: any) {
		editingId = patient.id;
		editFirst = patient.first_name ?? '';
		editLast = patient.last_name ?? '';
		editDob = patient.date_of_birth ?? '';
		editNote = patient.note ?? '';
	}

	function cancelEdit() {
		editingId = null;
	}

	function handleResult(action: string) {
		return ({ result }: any) => {
			if (result.type === 'success') {
				toastSuccess(`Patient ${action} successfully`);
				showAddForm = false;
				editingId = null;
			} else if (result.type === 'failure') {
				toastError(result.data?.error ?? `Failed to ${action} patient`);
			}
		};
	}
</script>

<svelte:head>
	<title>Manage Patients — Denials Tracker</title>
</svelte:head>

<div class="space-y-6">
	<header class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 class="text-xl font-semibold text-surface-900">Patients</h2>
			<p class="text-sm text-surface-500">
				Maintain the patient roster used across denials and reports.
			</p>
		</div>
		<button
			type="button"
			onclick={() => (showAddForm = !showAddForm)}
			class="btn btn-sm {showAddForm ? 'preset-tonal' : 'preset-filled-primary-500'}"
		>
			{showAddForm ? 'Cancel' : 'Add patient'}
		</button>
	</header>

	{#if showAddForm}
		<form
			method="POST"
			action="?/createPatient"
			use:enhance={() =>
				async ({ result, update }) => {
					handleResult('created')({ result });
					await update();
				}}
			class="card bg-surface-50 p-4"
		>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<label class="label">
					<span class="label-text">First name</span>
					<input id="first_name" name="first_name" type="text" required class="input" />
				</label>
				<label class="label">
					<span class="label-text">Last name</span>
					<input id="last_name" name="last_name" type="text" required class="input" />
				</label>
				<label class="label">
					<span class="label-text">Date of birth</span>
					<input id="date_of_birth" name="date_of_birth" type="date" required class="input" />
				</label>
				<label class="label">
					<span class="label-text">Note</span>
					<input id="note" name="note" type="text" class="input" />
				</label>
			</div>
			<div class="mt-4 flex justify-end gap-2">
				<button type="button" class="btn preset-tonal btn-sm" onclick={() => (showAddForm = false)}>
					Cancel
				</button>
				<button type="submit" class="btn preset-filled-primary-500 btn-sm"> Create patient </button>
			</div>
		</form>
	{/if}

	<div class="card border border-surface-200 bg-white p-0 shadow-sm">
		<div class="table-wrap">
			<table class="table caption-bottom">
				<thead>
					<tr>
						<th>Last name</th>
						<th>First name</th>
						<th>DOB</th>
						<th>Note</th>
						<th class="w-32 text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.patients as patient (patient.id)}
						{#if editingId === patient.id}
							<tr>
								<td>
									<form
										method="POST"
										action="?/updatePatient"
										use:enhance={() =>
											async ({ result, update }) => {
												handleResult('updated')({ result });
												await update();
											}}
										class="contents"
										id="edit-form-{patient.id}"
									>
										<input type="hidden" name="id" value={patient.id} />
										<input name="last_name" type="text" bind:value={editLast} class="input" />
									</form>
								</td>
								<td>
									<input
										form="edit-form-{patient.id}"
										name="first_name"
										type="text"
										bind:value={editFirst}
										class="input"
									/>
								</td>
								<td>
									<input
										form="edit-form-{patient.id}"
										name="date_of_birth"
										type="date"
										bind:value={editDob}
										class="input"
									/>
								</td>
								<td>
									<input
										form="edit-form-{patient.id}"
										name="note"
										type="text"
										bind:value={editNote}
										class="input"
									/>
								</td>
								<td>
									<div class="flex justify-end gap-2">
										<button
											type="button"
											onclick={() => cancelEdit()}
											class="btn preset-tonal btn-sm"
										>
											Cancel
										</button>
										<button
											form="edit-form-{patient.id}"
											type="submit"
											class="btn preset-filled-primary-500 btn-sm"
										>
											Save
										</button>
									</div>
								</td>
							</tr>
						{:else}
							<tr>
								<td class="font-medium text-surface-900">{patient.last_name}</td>
								<td>{patient.first_name}</td>
								<td class="text-surface-600">{patient.date_of_birth ?? '—'}</td>
								<td class="text-surface-600">{patient.note ?? ''}</td>
								<td>
									<div class="flex justify-end gap-2">
										<button
											type="button"
											onclick={() => startEdit(patient)}
											class="btn preset-tonal-primary btn-sm"
										>
											Edit
										</button>
										<form
											method="POST"
											action="?/deletePatient"
											use:enhance={() =>
												async ({ result, update }) => {
													handleResult('deleted')({ result });
													await update();
												}}
										>
											<input type="hidden" name="id" value={patient.id} />
											<button
												type="submit"
												onclick={(e) => {
													if (!confirm('Delete this patient?')) e.preventDefault();
												}}
												class="btn preset-tonal-error btn-sm"
											>
												Delete
											</button>
										</form>
									</div>
								</td>
							</tr>
						{/if}
					{:else}
						<tr>
							<td colspan="5">
								<div
									class="rounded-container border-2 border-dashed border-surface-200 p-8 text-center"
								>
									<p class="text-sm text-surface-500">No patients yet.</p>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
