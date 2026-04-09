<script lang="ts">
	import { enhance } from '$app/forms';
	import { toastSuccess, toastError } from '$lib/toast';

	let { data } = $props();

	let showAddForm = $state(false);
	let editingId = $state<number | null>(null);

	// Add form state
	let newRoleName = $state('');
	let newPermissions = $state<Record<string, boolean>>({});

	// Edit form state
	let editRoleName = $state('');
	let editPermissions = $state<Record<string, boolean>>({});

	function startEdit(role: any) {
		editingId = role.id;
		editRoleName = role.role_name ?? '';
		editPermissions = { ...(role.permissions as Record<string, boolean> ?? {}) };
	}

	function cancelEdit() {
		editingId = null;
	}

	function resetAddForm() {
		newRoleName = '';
		newPermissions = {};
	}

	function handleResult(action: string) {
		return ({ result }: any) => {
			if (result.type === 'success') {
				toastSuccess(`Role ${action} successfully`);
				showAddForm = false;
				editingId = null;
				resetAddForm();
			} else if (result.type === 'failure') {
				toastError(result.data?.error ?? `Failed to ${action} role`);
			}
		};
	}

	function formatPermissions(perms: Record<string, boolean> | null): string {
		if (!perms) return '—';
		const active = Object.entries(perms).filter(([, v]) => v).map(([k]) => k);
		return active.length ? active.join(', ') : '—';
	}
</script>

<svelte:head>
	<title>Manage Roles — Denials Tracker</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h2 class="text-xl font-semibold text-surface-900">Manage Roles</h2>
		<button
			type="button"
			onclick={() => { showAddForm = !showAddForm; resetAddForm(); }}
			class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
		>
			{showAddForm ? 'Cancel' : 'Add Role'}
		</button>
	</div>

	{#if showAddForm}
		<form
			method="POST"
			action="?/createRole"
			use:enhance={() => {
				return async ({ result, update }) => {
					handleResult('created')({ result });
					await update();
				};
			}}
			class="rounded-md border border-surface-200 bg-surface-50 p-4"
		>
			<div class="mb-4">
				<label for="role_name" class="mb-1 block text-sm font-medium text-surface-700">Role Name</label>
				<input id="role_name" name="role_name" type="text" required bind:value={newRoleName} class="w-full max-w-sm rounded-md border border-surface-300 px-3 py-2 text-sm" />
			</div>

			<input type="hidden" name="permissions" value={JSON.stringify(newPermissions)} />

			<div class="mb-4">
				<p class="mb-2 text-sm font-medium text-surface-700">Permissions</p>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
					{#each data.permissionKeys as key (key)}
						<label class="flex items-center gap-2 text-sm text-surface-700">
							<input type="checkbox" bind:checked={newPermissions[key]} class="rounded border-surface-300" />
							{key}
						</label>
					{/each}
				</div>
			</div>

			<button type="submit" class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
				Create Role
			</button>
		</form>
	{/if}

	<div class="overflow-x-auto">
		<table class="min-w-full divide-y divide-surface-200">
			<thead class="bg-surface-50">
				<tr>
					<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Role Name</th>
					<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Permissions</th>
					<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-surface-200 bg-white">
				{#each data.roles as role (role.id)}
					{#if editingId === role.id}
						<tr>
							<td class="px-4 py-2" colspan="3">
								<form
									method="POST"
									action="?/updateRole"
									use:enhance={() => {
										return async ({ result, update }) => {
											handleResult('updated')({ result });
											await update();
										};
									}}
									class="space-y-3"
								>
									<input type="hidden" name="id" value={role.id} />
									<input type="hidden" name="permissions" value={JSON.stringify(editPermissions)} />

									<div>
										<label for="edit-role-name" class="mb-1 block text-sm font-medium text-surface-700">Role Name</label>
										<input id="edit-role-name" name="role_name" type="text" bind:value={editRoleName} class="w-full max-w-sm rounded border border-surface-300 px-2 py-1 text-sm" />
									</div>

									<div>
										<p class="mb-2 text-sm font-medium text-surface-700">Permissions</p>
										<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
											{#each data.permissionKeys as key (key)}
												<label class="flex items-center gap-2 text-sm text-surface-700">
													<input type="checkbox" bind:checked={editPermissions[key]} class="rounded border-surface-300" />
													{key}
												</label>
											{/each}
										</div>
									</div>

									<div class="flex gap-2">
										<button type="submit" class="text-sm text-primary-600 hover:text-primary-800">Save</button>
										<button type="button" onclick={() => cancelEdit()} class="text-sm text-surface-500 hover:text-surface-700">Cancel</button>
									</div>
								</form>
							</td>
						</tr>
					{:else}
						<tr>
							<td class="px-4 py-3 text-sm font-medium text-surface-900">{role.role_name}</td>
							<td class="px-4 py-3 text-xs text-surface-600">{formatPermissions(role.permissions as any)}</td>
							<td class="px-4 py-3">
								<div class="flex gap-2">
									<button type="button" onclick={() => startEdit(role)} class="text-sm text-primary-600 hover:text-primary-800">Edit</button>
									<form
										method="POST"
										action="?/deleteRole"
										use:enhance={() => {
											return async ({ result, update }) => {
												handleResult('deleted')({ result });
												await update();
											};
										}}
									>
										<input type="hidden" name="id" value={role.id} />
										<button type="submit" onclick={(e) => { if (!confirm('Delete this role?')) e.preventDefault(); }} class="text-sm text-red-600 hover:text-red-800">Delete</button>
									</form>
								</div>
							</td>
						</tr>
					{/if}
				{:else}
					<tr>
						<td colspan="3" class="px-4 py-8 text-center text-sm text-surface-500">No roles found.</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
