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
	<title>Manage Users | Denials Tracker</title>
</svelte:head>

<div class="space-y-6">
	<header class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 class="text-xl font-semibold text-surface-900">Users</h2>
			<p class="text-sm text-surface-500">Workspace members and their assigned roles.</p>
		</div>
		<button
			type="button"
			onclick={() => (showAddForm = !showAddForm)}
			class="btn btn-sm {showAddForm ? 'preset-tonal' : 'preset-filled-primary-500'}"
		>
			{showAddForm ? 'Cancel' : 'Add user'}
		</button>
	</header>

	{#if showAddForm}
		<form
			method="POST"
			action="?/createUser"
			use:enhance={() =>
				async ({ result, update }) => {
					handleResult('created')({ result });
					await update();
				}}
			class="card bg-surface-50 p-4"
		>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<label class="label">
					<span class="label-text">Email</span>
					<input id="email" name="email" type="email" required class="input" />
				</label>
				<label class="label">
					<span class="label-text">Password</span>
					<input
						id="password"
						name="password"
						type="password"
						required
						minlength="8"
						class="input"
					/>
				</label>
				<label class="label">
					<span class="label-text">Role</span>
					<select id="role_id" name="role_id" class="select">
						<option value="">No role</option>
						{#each data.roles as role (role.id)}
							<option value={role.id}>{role.role_name}</option>
						{/each}
					</select>
				</label>
			</div>
			<div class="mt-4 flex justify-end gap-2">
				<button type="button" class="btn preset-tonal btn-sm" onclick={() => (showAddForm = false)}>
					Cancel
				</button>
				<button type="submit" class="btn preset-filled-primary-500 btn-sm"> Create user </button>
			</div>
		</form>
	{/if}

	<div class="card border border-surface-200 bg-white p-0 shadow-sm">
		<div class="table-wrap">
			<table class="table caption-bottom">
				<thead>
					<tr>
						<th>Username</th>
						<th>Role</th>
						<th>Created</th>
						<th class="w-32 text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.users as u (u.id)}
						{#if editingId === u.id}
							<tr>
								<td class="font-medium text-surface-900">{u.username ?? '—'}</td>
								<td>
									<form
										method="POST"
										action="?/updateUser"
										use:enhance={() =>
											async ({ result, update }) => {
												handleResult('updated')({ result });
												await update();
											}}
										class="contents"
										id="edit-user-{u.id}"
									>
										<input type="hidden" name="id" value={u.id} />
										<select name="role_id" bind:value={editRoleId} class="select">
											<option value="">No role</option>
											{#each data.roles as role (role.id)}
												<option value={role.id}>{role.role_name}</option>
											{/each}
										</select>
									</form>
								</td>
								<td class="text-surface-600">
									{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
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
											form="edit-user-{u.id}"
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
								<td class="font-medium text-surface-900">{u.username ?? '—'}</td>
								<td>
									{#if u.role}
										<span class="badge preset-tonal-primary">{getRoleName(u.role)}</span>
									{:else}
										<span class="text-surface-400">—</span>
									{/if}
								</td>
								<td class="text-surface-600">
									{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
								</td>
								<td>
									<div class="flex justify-end gap-2">
										<button
											type="button"
											onclick={() => startEdit(u)}
											class="btn preset-tonal-primary btn-sm"
										>
											Edit
										</button>
										<form
											method="POST"
											action="?/deleteUser"
											use:enhance={() =>
												async ({ result, update }) => {
													handleResult('deleted')({ result });
													await update();
												}}
										>
											<input type="hidden" name="id" value={u.id} />
											<button
												type="submit"
												onclick={(e) => {
													if (!confirm('Delete this user?')) e.preventDefault();
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
							<td colspan="4">
								<div
									class="rounded-container border-2 border-dashed border-surface-200 p-8 text-center"
								>
									<p class="text-sm text-surface-500">No users yet.</p>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
