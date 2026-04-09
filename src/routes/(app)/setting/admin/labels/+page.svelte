<script lang="ts">
	import { enhance } from '$app/forms';
	import { toastSuccess, toastError } from '$lib/toast';

	let { data } = $props();

	let showAddForm = $state(false);
	let editingId = $state<number | null>(null);
	let editName = $state('');
	let editBg = $state('#3b82f6');
	let editTxt = $state('#ffffff');
	let editOrder = $state(0);

	function startEdit(label: any) {
		editingId = label.id;
		editName = label.label_name ?? '';
		editBg = label.bg_color ?? '#3b82f6';
		editTxt = label.txt_color ?? '#ffffff';
		editOrder = label.order ?? 0;
	}

	function cancelEdit() {
		editingId = null;
	}

	function handleResult(action: string) {
		return ({ result }: any) => {
			if (result.type === 'success') {
				toastSuccess(`Label ${action} successfully`);
				showAddForm = false;
				editingId = null;
			} else if (result.type === 'failure') {
				toastError(result.data?.error ?? `Failed to ${action} label`);
			}
		};
	}
</script>

<svelte:head>
	<title>Manage Labels — Denials Tracker</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h2 class="text-xl font-semibold text-surface-900">Manage Labels</h2>
		<button
			type="button"
			onclick={() => (showAddForm = !showAddForm)}
			class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
		>
			{showAddForm ? 'Cancel' : 'Add Label'}
		</button>
	</div>

	{#if showAddForm}
		<form
			method="POST"
			action="?/createLabel"
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
					<label for="label_name" class="mb-1 block text-sm font-medium text-surface-700">Label Name</label>
					<input id="label_name" name="label_name" type="text" required class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm" />
				</div>
				<div>
					<label for="bg_color" class="mb-1 block text-sm font-medium text-surface-700">Background Color</label>
					<input id="bg_color" name="bg_color" type="color" value="#3b82f6" class="h-10 w-full rounded-md border border-surface-300" />
				</div>
				<div>
					<label for="txt_color" class="mb-1 block text-sm font-medium text-surface-700">Text Color</label>
					<input id="txt_color" name="txt_color" type="color" value="#ffffff" class="h-10 w-full rounded-md border border-surface-300" />
				</div>
				<div>
					<label for="order" class="mb-1 block text-sm font-medium text-surface-700">Order</label>
					<input id="order" name="order" type="number" value="0" class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm" />
				</div>
			</div>
			<div class="mt-4">
				<button type="submit" class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
					Create Label
				</button>
			</div>
		</form>
	{/if}

	<div class="overflow-x-auto">
		<table class="min-w-full divide-y divide-surface-200">
			<thead class="bg-surface-50">
				<tr>
					<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Preview</th>
					<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Label Name</th>
					<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">BG Color</th>
					<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Text Color</th>
					<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Order</th>
					<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-surface-200 bg-white">
				{#each data.labels as label (label.id)}
					{#if editingId === label.id}
						<tr>
							<td class="px-4 py-2">
								<span class="inline-block rounded px-2 py-1 text-xs font-medium" style="background-color: {editBg}; color: {editTxt};">
									{editName || 'Preview'}
								</span>
							</td>
							<td class="px-4 py-2" colspan="5">
								<form
									method="POST"
									action="?/updateLabel"
									use:enhance={() => {
										return async ({ result, update }) => {
											handleResult('updated')({ result });
											await update();
										};
									}}
									class="flex flex-wrap items-end gap-3"
								>
									<input type="hidden" name="id" value={label.id} />
									<div>
										<label for="edit-name" class="mb-1 block text-xs text-surface-600">Name</label>
										<input id="edit-name" name="label_name" type="text" bind:value={editName} class="rounded border border-surface-300 px-2 py-1 text-sm" />
									</div>
									<div>
										<label for="edit-bg" class="mb-1 block text-xs text-surface-600">BG</label>
										<input id="edit-bg" name="bg_color" type="color" bind:value={editBg} class="h-8 w-16 rounded border border-surface-300" />
									</div>
									<div>
										<label for="edit-txt" class="mb-1 block text-xs text-surface-600">Text</label>
										<input id="edit-txt" name="txt_color" type="color" bind:value={editTxt} class="h-8 w-16 rounded border border-surface-300" />
									</div>
									<div>
										<label for="edit-order" class="mb-1 block text-xs text-surface-600">Order</label>
										<input id="edit-order" name="order" type="number" bind:value={editOrder} class="w-20 rounded border border-surface-300 px-2 py-1 text-sm" />
									</div>
									<button type="submit" class="text-sm text-primary-600 hover:text-primary-800">Save</button>
									<button type="button" onclick={() => cancelEdit()} class="text-sm text-surface-500 hover:text-surface-700">Cancel</button>
								</form>
							</td>
						</tr>
					{:else}
						<tr>
							<td class="px-4 py-3">
								<span class="inline-block rounded px-2 py-1 text-xs font-medium" style="background-color: {label.bg_color}; color: {label.txt_color};">
									{label.label_name}
								</span>
							</td>
							<td class="px-4 py-3 text-sm text-surface-900">{label.label_name}</td>
							<td class="px-4 py-3 text-sm text-surface-600">{label.bg_color}</td>
							<td class="px-4 py-3 text-sm text-surface-600">{label.txt_color}</td>
							<td class="px-4 py-3 text-sm text-surface-600">{label.order}</td>
							<td class="px-4 py-3">
								<div class="flex gap-2">
									<button type="button" onclick={() => startEdit(label)} class="text-sm text-primary-600 hover:text-primary-800">Edit</button>
									<form
										method="POST"
										action="?/deleteLabel"
										use:enhance={() => {
											return async ({ result, update }) => {
												handleResult('deleted')({ result });
												await update();
											};
										}}
									>
										<input type="hidden" name="id" value={label.id} />
										<button type="submit" onclick={(e) => { if (!confirm('Delete this label?')) e.preventDefault(); }} class="text-sm text-red-600 hover:text-red-800">Delete</button>
									</form>
								</div>
							</td>
						</tr>
					{/if}
				{:else}
					<tr>
						<td colspan="6" class="px-4 py-8 text-center text-sm text-surface-500">No labels found.</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
