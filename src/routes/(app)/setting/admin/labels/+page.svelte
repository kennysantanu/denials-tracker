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
	let editBg = $state('#3b82f6');
	let editTxt = $state('#ffffff');
	let editOrder = $state(0);

	let permissions = $derived((page.data as any).effectivePermissions ?? {});
	let canCreate = $derived(permissions['label.create'] === true || permissions['break_glass.admin'] === true);
	let canUpdate = $derived(permissions['label.update'] === true || permissions['break_glass.admin'] === true);
	let canDelete = $derived(permissions['label.delete'] === true || permissions['break_glass.admin'] === true);

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
				actionError = null;
				showAddForm = false;
				editingId = null;
				deleteId = null;
			} else if (result.type === 'failure') {
				const message = result.data?.error ?? `Failed to ${action} label`;
				actionError = message;
				toastError(message);
			}
		};
	}

	function confirmDelete() {
		if (!deleteId) return;
		(document.getElementById(`delete-label-${deleteId}`) as HTMLFormElement | null)?.requestSubmit();
	}
</script>

<svelte:head>
	<title>Manage Labels | Denials Tracker</title>
</svelte:head>

<div class="space-y-6">
	<header class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 class="text-xl font-semibold text-surface-900">Labels</h2>
			<p class="text-sm text-surface-500">Color-coded tags for categorizing denials and notes.</p>
		</div>
		{#if canCreate}
			<button
				type="button"
				onclick={() => (showAddForm = !showAddForm)}
				class="btn btn-sm {showAddForm ? 'preset-tonal' : 'preset-filled-primary-500'}"
			>
				{showAddForm ? 'Cancel' : 'Add label'}
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
			action="?/createLabel"
			use:enhance={() =>
				async ({ result, update }) => {
					handleResult('created')({ result });
					await update();
				}}
			class="card bg-surface-50 p-4"
		>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<label class="label">
					<span class="label-text">Label name</span>
					<input id="label_name" name="label_name" type="text" required class="input" />
				</label>
				<label class="label">
					<span class="label-text">Background color</span>
					<input id="bg_color" name="bg_color" type="color" value="#3b82f6" class="input h-10" />
				</label>
				<label class="label">
					<span class="label-text">Text color</span>
					<input id="txt_color" name="txt_color" type="color" value="#ffffff" class="input h-10" />
				</label>
				<label class="label">
					<span class="label-text">Order</span>
					<input id="order" name="order" type="number" value="0" class="input" />
				</label>
			</div>
			<div class="mt-4 flex justify-end gap-2">
				<button type="button" class="btn preset-tonal btn-sm" onclick={() => (showAddForm = false)}>
					Cancel
				</button>
				<button type="submit" class="btn preset-filled-primary-500 btn-sm"> Create label </button>
			</div>
		</form>
	{/if}

	<div class="card border border-surface-200 bg-white p-0 shadow-sm">
		<div class="table-wrap">
			<table class="table caption-bottom">
				<thead>
					<tr>
						<th>Preview</th>
						<th>Name</th>
						<th>BG</th>
						<th>Text</th>
						<th>Order</th>
						<th class="w-32 text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.labels as label (label.id)}
						{#if editingId === label.id}
							<tr>
								<td>
									<span
										class="inline-block rounded-base px-2 py-1 text-xs font-medium"
										style="background-color: {editBg}; color: {editTxt};"
									>
										{editName || 'Preview'}
									</span>
								</td>
								<td colspan="5">
									<form
										method="POST"
										action="?/updateLabel"
										use:enhance={() =>
											async ({ result, update }) => {
												handleResult('updated')({ result });
												await update();
											}}
										class="flex flex-wrap items-end gap-3"
									>
										<input type="hidden" name="id" value={label.id} />
										<label class="label">
											<span class="label-text">Name</span>
											<input name="label_name" type="text" bind:value={editName} class="input" aria-label="Label name" />
										</label>
										<label class="label">
											<span class="label-text">BG</span>
											<input
												name="bg_color"
												type="color"
												bind:value={editBg}
												class="input h-10 w-20"
												aria-label="Background color"
											/>
										</label>
										<label class="label">
											<span class="label-text">Text</span>
											<input
												name="txt_color"
												type="color"
												bind:value={editTxt}
												class="input h-10 w-20"
												aria-label="Text color"
											/>
										</label>
										<label class="label">
											<span class="label-text">Order</span>
											<input name="order" type="number" bind:value={editOrder} class="input w-24" aria-label="Sort order" />
										</label>
										<div class="ml-auto flex gap-2">
											<button
												type="button"
												onclick={() => cancelEdit()}
												class="btn preset-tonal btn-sm"
											>
												Cancel
											</button>
											<button type="submit" class="btn preset-filled-primary-500 btn-sm">
												Save
											</button>
										</div>
									</form>
								</td>
							</tr>
						{:else}
							<tr>
								<td>
									<span
										class="inline-block rounded-base px-2 py-1 text-xs font-medium"
										style="background-color: {label.bg_color}; color: {label.txt_color};"
									>
										{label.label_name}
									</span>
								</td>
								<td class="font-medium text-surface-900">{label.label_name}</td>
								<td class="font-mono text-xs text-surface-600">{label.bg_color}</td>
								<td class="font-mono text-xs text-surface-600">{label.txt_color}</td>
								<td class="text-surface-600">{label.order}</td>
								<td>
									<div class="flex justify-end gap-2">
										{#if canUpdate}
											<button
												type="button"
												onclick={() => startEdit(label)}
												class="btn preset-tonal-primary btn-sm"
											>
												Edit
											</button>
										{/if}
										{#if canDelete}
											<form
												id="delete-label-{label.id}"
												method="POST"
												action="?/deleteLabel"
												use:enhance={() =>
													async ({ result, update }) => {
														handleResult('deleted')({ result });
														await update();
													}}
											>
												<input type="hidden" name="id" value={label.id} />
												<button
													type="button"
													onclick={() => (deleteId = label.id)}
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
							<td colspan="6">
								<div
									class="rounded-container border-2 border-dashed border-surface-200 p-8 text-center"
								>
									<p class="text-sm text-surface-500">No labels yet.</p>
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
	title="Delete label?"
	message="This removes the label from future selection."
	confirmLabel="Delete label"
	onconfirm={confirmDelete}
	oncancel={() => (deleteId = null)}
/>
