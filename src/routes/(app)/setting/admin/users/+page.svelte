<script lang="ts">
	import { enhance } from '$app/forms';
	import { toastSuccess, toastError } from '$lib/toast';

	let { data } = $props();

	let showAddForm = $state(false);
	let editingId = $state<string | null>(null);
	let editRoleId = $state<number | undefined>(undefined);

	function startEdit(user: any) {
		editingId = user.id;
		editRoleId = user.role ?? undefined;
	}

	function cancelEdit() {
		editingId = null;
	}

	function handleResult(action: string) {
		return ({ result }: any) => {
			if (result.type === 'success') {
				toastSuccess(`User ${action} successfully`);
				showAddForm = false;
				editingId = null;
			} else if (result.type === 'failure') {
				toastError(result.data?.error ?? `Failed to ${action} user`);
			}
		};
	}

	function getRoleName(roleId: number | null): string {
		if (!roleId) return '—';
		const role = data.roles.find((r: any) => r.id === roleId);
		return role?.role_name ?? '—';
	}
</script>

<svelte:head>
	<title>Manage Users — Denials Tracker</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h2 class="text-xl font-semibold text-surface-900">Manage Users</h2>
		<button
			type="button"
			onclick={() => (showAddForm = !showAddForm)}
			class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
		>
			{showAddForm ? 'Cancel' : 'Add User'}
		</button>
	</div>

	{#if showAddForm}
		<form
			method="POST"
			action="?/createUser"
			use:enhance={() => {
				return async ({ result, update }) => {
					handleResult('created')({ result });
					await update();
				};
			}}
			class="rounded-md border border-surface-200 bg-surface-50 p-4"
		>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<div>
					<label for="email" class="mb-1 block text-sm font-medium text-surface-700">Email</label>
					<input id="email" name="email" type="email" required class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm" />
				</div>
				<div>
					<label for="password" class="mb-1 block text-sm font-medium text-surface-700">Password</label>
					<input id="password" name="password" type="password" required minlength="8" class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm" />
				</div>
				<div>
					<label for="role_id" class="mb-1 block text-sm font-medium text-surface-700">Role</label>
					<select id="role_id" name="role_id" class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm">
						<option value="">No role</option>
						{#each data.roles as role (role.id)}
							<option value={role.id}>{role.role_name}</option>
						{/each}
					</select>
				</div>
			</div>
			<div class="mt-4">
				<button type="submit" class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
					Create User
				</button>
			</div>
		</form>
	{/if}

	<div class="overflow-x-auto">
		<table class="min-w-full divide-y divide-surface-200">
			<thead class="bg-surface-50">
				<tr>
					<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Username</th>
					<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Role</th>
					<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Created At</th>
					<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-surface-200 bg-white">
				{#each data.users as u (u.id)}
					{#if editingId === u.id}
						<tr>
							<td class="px-4 py-3 text-sm text-surface-900">{u.username ?? '—'}</td>
							<td class="px-4 py-2">
								<form
									method="POST"
									action="?/updateUser"
									use:enhance={() => {
										return async ({ result, update }) => {
											handleResult('updated')({ result });
											await update();
										};
									}}
									class="flex items-center gap-2"
									id="edit-user-{u.id}"
								>
									<input type="hidden" name="id" value={u.id} />
									<select name="role_id" bind:value={editRoleId} class="rounded border border-surface-300 px-2 py-1 text-sm">
										<option value="">No role</option>
										{#each data.roles as role (role.id)}
											<option value={role.id}>{role.role_name}</option>
										{/each}
									</select>
								</form>
							</td>
							<td class="px-4 py-3 text-sm text-surface-600">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
							<td class="px-4 py-2">
								<div class="flex gap-2">
									<button form="edit-user-{u.id}" type="submit" class="text-sm text-primary-600 hover:text-primary-800">Save</button>
									<button type="button" onclick={() => cancelEdit()} class="text-sm text-surface-500 hover:text-surface-700">Cancel</button>
								</div>
							</td>
						</tr>
					{:else}
						<tr>
							<td class="px-4 py-3 text-sm text-surface-900">{u.username ?? '—'}</td>
							<td class="px-4 py-3 text-sm text-surface-600">{getRoleName(u.role)}</td>
							<td class="px-4 py-3 text-sm text-surface-600">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
							<td class="px-4 py-3">
								<div class="flex gap-2">
									<button type="button" onclick={() => startEdit(u)} class="text-sm text-primary-600 hover:text-primary-800">Edit</button>
									<form
										method="POST"
										action="?/deleteUser"
										use:enhance={() => {
											return async ({ result, update }) => {
												handleResult('deleted')({ result });
												await update();
											};
										}}
									>
										<input type="hidden" name="id" value={u.id} />
										<button type="submit" onclick={(e) => { if (!confirm('Delete this user?')) e.preventDefault(); }} class="text-sm text-red-600 hover:text-red-800">Delete</button>
									</form>
								</div>
							</td>
						</tr>
					{/if}
				{:else}
					<tr>
						<td colspan="4" class="px-4 py-8 text-center text-sm text-surface-500">No users found.</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
