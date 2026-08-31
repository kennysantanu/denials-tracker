<script lang="ts">
	import { enhance } from '$app/forms';
	import { toastSuccess, toastError } from '$lib/toast';
	import { page } from '$app/state';
	import { ConfirmDialog } from '$lib/components/ui';

	let { data } = $props();

	let showAddForm = $state(false);
	let editingId = $state<number | null>(null);
	let deleteId = $state<number | null>(null);
	let actionError = $state<string | null>(null);
	let editName = $state('');
	let editNote = $state('');

	let permissions = $derived((page.data as any).effectivePermissions ?? {});
	let canCreate = $derived(permissions['insurance.create'] === true || permissions['break_glass.admin'] === true);
	let canUpdate = $derived(permissions['insurance.update'] === true || permissions['break_glass.admin'] === true);
	let canDelete = $derived(permissions['insurance.delete'] === true || permissions['break_glass.admin'] === true);

	function startEdit(ins: any) {
		editingId = ins.id;
		editName = ins.name ?? '';
		editNote = ins.note ?? '';
	}

	function cancelEdit() {
		editingId = null;
	}

	function handleResult(action: string) {
		return ({ result }: any) => {
			if (result.type === 'success') {
				toastSuccess(`Insurance ${action} successfully`);
				actionError = null;
				showAddForm = false;
				editingId = null;
				deleteId = null;
			} else if (result.type === 'failure') {
				const message = result.data?.error ?? `Failed to ${action} insurance`;
				actionError = message;
				toastError(message);
			}
		};
	}

	function confirmDelete() {
		if (!deleteId) return;
		(document.getElementById(`delete-insurance-${deleteId}`) as HTMLFormElement | null)?.requestSubmit();
	}
</script>

<svelte:head>
	<title>Manage Insurances | Denials Tracker</title>
</svelte:head>

<div class="space-y-6">
	<header class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 class="text-xl font-semibold text-surface-900">Insurances</h2>
			<p class="text-sm text-surface-500">
				List of payers selectable on denials. Names should be unique.
			</p>
		</div>
		{#if canCreate}
			<button
				type="button"
				onclick={() => (showAddForm = !showAddForm)}
				class="btn btn-sm {showAddForm ? 'preset-tonal' : 'preset-filled-primary-500'}"
			>
				{showAddForm ? 'Cancel' : 'Add insurance'}
			</button>
		{/if}
	</header>

	{#if actionError}
		<div class="rounded-base border-l-4 border-error-500 bg-error-50 p-4 text-sm text-error-700" role="alert">
			{actionError}
		</div>
	{/if}

	{#if showAddForm && canCreate}
		<form
			method="POST"
			action="?/createInsurance"
			use:enhance={() =>
				async ({ result, update }) => {
					handleResult('created')({ result });
					await update();
				}}
			class="card bg-surface-50 p-4"
		>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<label class="label">
					<span class="label-text">Name</span>
					<input id="name" name="name" type="text" required class="input" />
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
				<button type="submit" class="btn preset-filled-primary-500 btn-sm">
					Create insurance
				</button>
			</div>
		</form>
	{/if}

	<div class="card border border-surface-200 bg-white p-0 shadow-sm">
		<div class="table-wrap">
			<table class="table caption-bottom">
				<thead>
					<tr>
						<th>Name</th>
						<th>Note</th>
						<th class="w-32 text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.insurances as ins (ins.id)}
						{#if editingId === ins.id}
							<tr>
								<td>
									<form
										method="POST"
										action="?/updateInsurance"
										use:enhance={() =>
											async ({ result, update }) => {
												handleResult('updated')({ result });
												await update();
											}}
										class="contents"
										id="edit-ins-{ins.id}"
									>
										<input type="hidden" name="id" value={ins.id} />
										<input name="name" type="text" bind:value={editName} class="input" aria-label="Insurance name" />
									</form>
								</td>
								<td>
									<input
										form="edit-ins-{ins.id}"
										name="note"
										type="text"
										bind:value={editNote}
										class="input"
										aria-label="Insurance note"
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
											form="edit-ins-{ins.id}"
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
								<td class="font-medium text-surface-900">{ins.name}</td>
								<td class="text-surface-600">{ins.note ?? ''}</td>
								<td>
									<div class="flex justify-end gap-2">
										{#if canUpdate}
											<button
												type="button"
												onclick={() => startEdit(ins)}
												class="btn preset-tonal-primary btn-sm"
											>
												Edit
											</button>
										{/if}
										{#if canDelete}
											<form
												id="delete-insurance-{ins.id}"
												method="POST"
												action="?/deleteInsurance"
												use:enhance={() =>
													async ({ result, update }) => {
														handleResult('deleted')({ result });
														await update();
													}}
											>
												<input type="hidden" name="id" value={ins.id} />
												<button
													type="button"
													onclick={() => (deleteId = ins.id)}
													class="btn preset-tonal-error btn-sm"
												>
													Delete
												</button>
											</form>
										{/if}
									</div>
								</td>
							</tr>
						{/if}
					{:else}
						<tr>
							<td colspan="3">
								<div
									class="rounded-container border-2 border-dashed border-surface-200 p-8 text-center"
								>
									<p class="text-sm text-surface-500">No insurances yet.</p>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

<ConfirmDialog
	open={deleteId !== null}
	title="Delete insurance?"
	message="This removes the payer from the settings list."
	confirmLabel="Delete insurance"
	onconfirm={confirmDelete}
	oncancel={() => (deleteId = null)}
/>
