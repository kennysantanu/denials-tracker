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
	<div class="flex items-center justify-between">
		<h2 class="text-xl font-semibold text-surface-900">Manage Patients</h2>
		<button
			type="button"
			onclick={() => (showAddForm = !showAddForm)}
			class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
		>
			{showAddForm ? 'Cancel' : 'Add Patient'}
		</button>
	</div>

	<!-- Add Patient Form -->
	{#if showAddForm}
		<form
			method="POST"
			action="?/createPatient"
			use:enhance={() => {
				return async ({ result, update }) => {
					handleResult('created')({ result });
					await update();
				};
			}}
			class="rounded-md border border-surface-200 bg-surface-50 p-4"
		>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div>
					<label for="first_name" class="mb-1 block text-sm font-medium text-surface-700">First Name</label>
					<input id="first_name" name="first_name" type="text" required class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm" />
				</div>
				<div>
					<label for="last_name" class="mb-1 block text-sm font-medium text-surface-700">Last Name</label>
					<input id="last_name" name="last_name" type="text" required class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm" />
				</div>
				<div>
					<label for="date_of_birth" class="mb-1 block text-sm font-medium text-surface-700">Date of Birth</label>
					<input id="date_of_birth" name="date_of_birth" type="date" required class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm" />
				</div>
				<div>
					<label for="note" class="mb-1 block text-sm font-medium text-surface-700">Note</label>
					<input id="note" name="note" type="text" class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm" />
				</div>
			</div>
			<div class="mt-4">
				<button type="submit" class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
					Create Patient
				</button>
			</div>
		</form>
	{/if}

	<!-- Patients Table -->
	<div class="overflow-x-auto">
		<table class="min-w-full divide-y divide-surface-200">
			<thead class="bg-surface-50">
				<tr>
					<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Last Name</th>
					<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">First Name</th>
					<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">DOB</th>
					<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Note</th>
					<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-surface-200 bg-white">
				{#each data.patients as patient (patient.id)}
					{#if editingId === patient.id}
						<tr>
							<td class="px-4 py-2">
								<form
									method="POST"
									action="?/updatePatient"
									use:enhance={() => {
										return async ({ result, update }) => {
											handleResult('updated')({ result });
											await update();
										};
									}}
									class="contents"
									id="edit-form-{patient.id}"
								>
									<input type="hidden" name="id" value={patient.id} />
									<input name="last_name" type="text" bind:value={editLast} class="w-full rounded border border-surface-300 px-2 py-1 text-sm" />
								</form>
							</td>
							<td class="px-4 py-2">
								<input form="edit-form-{patient.id}" name="first_name" type="text" bind:value={editFirst} class="w-full rounded border border-surface-300 px-2 py-1 text-sm" />
							</td>
							<td class="px-4 py-2">
								<input form="edit-form-{patient.id}" name="date_of_birth" type="date" bind:value={editDob} class="w-full rounded border border-surface-300 px-2 py-1 text-sm" />
							</td>
							<td class="px-4 py-2">
								<input form="edit-form-{patient.id}" name="note" type="text" bind:value={editNote} class="w-full rounded border border-surface-300 px-2 py-1 text-sm" />
							</td>
							<td class="px-4 py-2">
								<div class="flex gap-2">
									<button form="edit-form-{patient.id}" type="submit" class="text-sm text-primary-600 hover:text-primary-800">Save</button>
									<button type="button" onclick={() => cancelEdit()} class="text-sm text-surface-500 hover:text-surface-700">Cancel</button>
								</div>
							</td>
						</tr>
					{:else}
						<tr>
							<td class="px-4 py-3 text-sm text-surface-900">{patient.last_name}</td>
							<td class="px-4 py-3 text-sm text-surface-900">{patient.first_name}</td>
							<td class="px-4 py-3 text-sm text-surface-600">{patient.date_of_birth}</td>
							<td class="px-4 py-3 text-sm text-surface-600">{patient.note ?? ''}</td>
							<td class="px-4 py-3">
								<div class="flex gap-2">
									<button type="button" onclick={() => startEdit(patient)} class="text-sm text-primary-600 hover:text-primary-800">Edit</button>
									<form
										method="POST"
										action="?/deletePatient"
										use:enhance={() => {
											return async ({ result, update }) => {
												handleResult('deleted')({ result });
												await update();
											};
										}}
									>
										<input type="hidden" name="id" value={patient.id} />
										<button type="submit" onclick={(e) => { if (!confirm('Delete this patient?')) e.preventDefault(); }} class="text-sm text-red-600 hover:text-red-800">Delete</button>
									</form>
								</div>
							</td>
						</tr>
					{/if}
				{:else}
					<tr>
						<td colspan="5" class="px-4 py-8 text-center text-sm text-surface-500">No patients found.</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
