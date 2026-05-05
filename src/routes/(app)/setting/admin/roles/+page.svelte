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
		editPermissions = { ...((role.permissions as Record<string, boolean>) ?? {}) };
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

	function activePerms(perms: Record<string, boolean> | null): string[] {
		if (!perms) return [];
		return Object.entries(perms)
			.filter(([, v]) => v)
			.map(([k]) => k);
	}
</script>

<svelte:head>
	<title>Manage Roles | Denials Tracker</title>
</svelte:head>

<div class="space-y-6">
	<header class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 class="text-xl font-semibold text-surface-900">Roles</h2>
			<p class="text-sm text-surface-500">
				Define roles and the permissions granted to users assigned to them.
			</p>
		</div>
		<button
			type="button"
			onclick={() => {
				showAddForm = !showAddForm;
				resetAddForm();
			}}
			class="btn btn-sm {showAddForm ? 'preset-tonal' : 'preset-filled-primary-500'}"
		>
			{showAddForm ? 'Cancel' : 'Add role'}
		</button>
	</header>

	{#if showAddForm}
		<form
			method="POST"
			action="?/createRole"
			use:enhance={() =>
				async ({ result, update }) => {
					handleResult('created')({ result });
					await update();
				}}
			class="card bg-surface-50 p-4"
		>
			<input type="hidden" name="permissions" value={JSON.stringify(newPermissions)} />

			<label class="label max-w-sm">
				<span class="label-text">Role name</span>
				<input
					id="role_name"
					name="role_name"
					type="text"
					required
					bind:value={newRoleName}
					class="input"
				/>
			</label>

			<fieldset class="mt-4">
				<legend class="mb-2 text-sm font-medium text-surface-700">Permissions</legend>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
					{#each data.permissionKeys as key (key)}
						<label class="flex items-center gap-2 text-sm text-surface-700">
							<input type="checkbox" bind:checked={newPermissions[key]} class="checkbox" />
							<span>{key}</span>
						</label>
					{/each}
				</div>
			</fieldset>

			<div class="mt-4 flex justify-end gap-2">
				<button
					type="button"
					class="btn preset-tonal btn-sm"
					onclick={() => {
						showAddForm = false;
						resetAddForm();
					}}
				>
					Cancel
				</button>
				<button type="submit" class="btn preset-filled-primary-500 btn-sm"> Create role </button>
			</div>
		</form>
	{/if}

	<div class="card border border-surface-200 bg-white p-0 shadow-sm">
		<div class="table-wrap">
			<table class="table caption-bottom">
				<thead>
					<tr>
						<th>Role</th>
						<th>Permissions</th>
						<th class="w-32 text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.roles as role (role.id)}
						{#if editingId === role.id}
							<tr>
								<td colspan="3">
									<form
										method="POST"
										action="?/updateRole"
										use:enhance={() =>
											async ({ result, update }) => {
												handleResult('updated')({ result });
												await update();
											}}
										class="space-y-4"
									>
										<input type="hidden" name="id" value={role.id} />
										<input
											type="hidden"
											name="permissions"
											value={JSON.stringify(editPermissions)}
										/>

										<label class="label max-w-sm">
											<span class="label-text">Role name</span>
											<input
												id="edit-role-name"
												name="role_name"
												type="text"
												bind:value={editRoleName}
												class="input"
											/>
										</label>

										<fieldset>
											<legend class="mb-2 text-sm font-medium text-surface-700">
												Permissions
											</legend>
											<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
												{#each data.permissionKeys as key (key)}
													<label class="flex items-center gap-2 text-sm text-surface-700">
														<input
															type="checkbox"
															bind:checked={editPermissions[key]}
															class="checkbox"
														/>
														<span>{key}</span>
													</label>
												{/each}
											</div>
										</fieldset>

										<div class="flex justify-end gap-2">
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
							{@const perms = activePerms(role.permissions as any)}
							<tr>
								<td class="font-medium text-surface-900">{role.role_name}</td>
								<td>
									{#if perms.length === 0}
										<span class="text-surface-400">—</span>
									{:else}
										<div class="flex flex-wrap gap-1">
											{#each perms as p (p)}
												<span class="badge preset-tonal-surface text-xs">{p}</span>
											{/each}
										</div>
									{/if}
								</td>
								<td>
									<div class="flex justify-end gap-2">
										<button
											type="button"
											onclick={() => startEdit(role)}
											class="btn preset-tonal-primary btn-sm"
										>
											Edit
										</button>
										<form
											method="POST"
											action="?/deleteRole"
											use:enhance={() =>
												async ({ result, update }) => {
													handleResult('deleted')({ result });
													await update();
												}}
										>
											<input type="hidden" name="id" value={role.id} />
											<button
												type="submit"
												onclick={(e) => {
													if (!confirm('Delete this role?')) e.preventDefault();
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
							<td colspan="3">
								<div
									class="rounded-container border-2 border-dashed border-surface-200 p-8 text-center"
								>
									<p class="text-sm text-surface-500">No roles yet.</p>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
