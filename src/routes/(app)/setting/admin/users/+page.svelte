<script lang="ts">
	import { enhance } from '$app/forms';
	import { toastSuccess, toastError } from '$lib/toast';
	import { page } from '$app/state';
	import { ConfirmDialog } from '$lib/components/ui';

	let { data } = $props();

	let showAddForm = $state(false);
	let editingId = $state<string | null>(null);
	let deleteId = $state<string | null>(null);
	let actionError = $state<string | null>(null);
	let editRoleId = $state<number | undefined>(undefined);
	let resetPasswordId = $state<string | null>(null);
	let resetPasswordValue = $state('');
	let changeEmailId = $state<string | null>(null);
	let changeEmailValue = $state('');
	let changeUsernameId = $state<string | null>(null);
	let changeUsernameValue = $state('');

	let permissions = $derived((page.data as any).effectivePermissions ?? {});
	let canCreate = $derived(
		permissions['user.create'] === true || permissions['break_glass.admin'] === true
	);
	let canUpdate = $derived(
		permissions['user.update'] === true || permissions['break_glass.admin'] === true
	);
	let canDelete = $derived(
		permissions['user.delete'] === true || permissions['break_glass.admin'] === true
	);

	function startEdit(user: any) {
		editingId = user.id;
		editRoleId = user.role_id ?? undefined;
		resetPasswordId = null;
		changeEmailId = null;
	}

	function cancelEdit() {
		editingId = null;
	}

	function startResetPassword(user: any) {
		resetPasswordId = user.id;
		resetPasswordValue = '';
		changeEmailId = null;
		editingId = null;
	}

	function startChangeEmail(user: any) {
		changeEmailId = user.id;
		changeEmailValue = user.email ?? '';
		resetPasswordId = null;
		changeUsernameId = null;
		editingId = null;
	}

	function startChangeUsername(user: any) {
		changeUsernameId = user.id;
		changeUsernameValue = user.username ?? '';
		changeEmailId = null;
		resetPasswordId = null;
		editingId = null;
	}

	function cancelInline() {
		resetPasswordId = null;
		changeEmailId = null;
		changeUsernameId = null;
	}

	function handleResult(action: string) {
		return ({ result }: any) => {
			if (result.type === 'success') {
				toastSuccess(`User ${action} successfully`);
				actionError = null;
				showAddForm = false;
				editingId = null;
				deleteId = null;
				resetPasswordId = null;
				changeEmailId = null;
				changeUsernameId = null;
			} else if (result.type === 'failure') {
				const message = result.data?.error ?? `Failed to ${action} user`;
				actionError = message;
				toastError(message);
			}
		};
	}

	function confirmDelete() {
		if (!deleteId) return;
		(document.getElementById(`delete-user-${deleteId}`) as HTMLFormElement | null)?.requestSubmit();
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
		{#if canCreate}
			<button
				type="button"
				onclick={() => (showAddForm = !showAddForm)}
				class="btn btn-sm {showAddForm ? 'preset-tonal' : 'preset-filled-primary-500'}"
			>
				{showAddForm ? 'Cancel' : 'Add user'}
			</button>
		{/if}
	</header>

	{#if actionError}
		<div
			class="rounded-base border-l-4 border-error-500 bg-error-50 p-4 text-sm text-error-700"
			role="alert"
		>
			{actionError}
		</div>
	{/if}

	{#if showAddForm && canCreate}
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
						<th>Email</th>
						<th>Role</th>
						<th>Created</th>
						<th class="w-64 text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.users as u (u.id)}
						{#if editingId === u.id}
							<tr>
								<td class="font-medium text-surface-900">{u.username ?? '—'}</td>
								<td class="text-sm text-surface-600">{u.email ?? '—'}</td>
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
										<select name="role_id" bind:value={editRoleId} class="select" aria-label="Role">
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
						{:else if resetPasswordId === u.id}
							<tr>
								<td class="font-medium text-surface-900">{u.username ?? '—'}</td>
								<td colspan="3">
									<form
										method="POST"
										action="?/resetPassword"
										use:enhance={() =>
											async ({ result, update }) => {
												handleResult('password reset')({ result });
												await update();
											}}
										class="flex items-center gap-2"
										id="reset-pw-{u.id}"
									>
										<input type="hidden" name="id" value={u.id} />
										<input
											type="password"
											name="password"
											required
											minlength="8"
											placeholder="New password (min 8 chars)"
											bind:value={resetPasswordValue}
											class="input"
											aria-label="New password"
										/>
									</form>
								</td>
								<td>
									<div class="flex justify-end gap-2">
										<button type="button" onclick={cancelInline} class="btn preset-tonal btn-sm">
											Cancel
										</button>
										<button
											form="reset-pw-{u.id}"
											type="submit"
											class="btn preset-filled-warning-500 btn-sm"
										>
											Reset
										</button>
									</div>
								</td>
							</tr>
						{:else if changeEmailId === u.id}
							<tr>
								<td class="font-medium text-surface-900">{u.username ?? '—'}</td>
								<td colspan="3">
									<form
										method="POST"
										action="?/updateEmail"
										use:enhance={() =>
											async ({ result, update }) => {
												handleResult('email updated')({ result });
												await update();
											}}
										class="flex items-center gap-2"
										id="change-email-{u.id}"
									>
										<input type="hidden" name="id" value={u.id} />
										<input
											type="email"
											name="email"
											required
											placeholder="New email"
											bind:value={changeEmailValue}
											class="input"
											aria-label="New email"
										/>
									</form>
								</td>
								<td>
									<div class="flex justify-end gap-2">
										<button type="button" onclick={cancelInline} class="btn preset-tonal btn-sm">
											Cancel
										</button>
										<button
											form="change-email-{u.id}"
											type="submit"
											class="btn preset-filled-primary-500 btn-sm"
										>
											Save
										</button>
									</div>
								</td>
							</tr>
						{:else if changeUsernameId === u.id}
							<tr>
								<td colspan="4">
									<form
										method="POST"
										action="?/updateUsername"
										use:enhance={() =>
											async ({ result, update }) => {
												handleResult('username updated')({ result });
												await update();
											}}
										class="flex items-center gap-2"
										id="change-username-{u.id}"
									>
										<input type="hidden" name="id" value={u.id} />
										<input
											type="text"
											name="username"
											required
											placeholder="Display name"
											bind:value={changeUsernameValue}
											class="input"
											aria-label="Display name"
										/>
									</form>
								</td>
								<td>
									<div class="flex justify-end gap-2">
										<button type="button" onclick={cancelInline} class="btn preset-tonal btn-sm">
											Cancel
										</button>
										<button
											form="change-username-{u.id}"
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
								<td class="text-sm text-surface-600">{u.email ?? '—'}</td>
								<td>
									{#if u.role_id}
										<span class="badge preset-tonal-primary">{u.role_name}</span>
									{:else}
										<span class="text-surface-400">—</span>
									{/if}
								</td>
								<td class="text-surface-600">
									{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
								</td>
								<td>
									<div class="flex justify-end gap-2">
										{#if canUpdate}
											<button
												type="button"
												onclick={() => startEdit(u)}
												class="btn preset-tonal-primary btn-sm"
											>
												Edit role
											</button>
											<button
												type="button"
												onclick={() => startChangeUsername(u)}
												class="btn preset-tonal-primary btn-sm"
											>
												Username
											</button>
											<button
												type="button"
												onclick={() => startChangeEmail(u)}
												class="btn preset-tonal-primary btn-sm"
											>
												Email
											</button>
											<button
												type="button"
												onclick={() => startResetPassword(u)}
												class="btn preset-tonal-warning btn-sm"
											>
												Reset PW
											</button>
										{/if}
										{#if canDelete}
											<form
												id="delete-user-{u.id}"
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
													type="button"
													onclick={() => (deleteId = u.id)}
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
							<td colspan="5">
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

<ConfirmDialog
	open={deleteId !== null}
	title="Delete user?"
	message="This deletes the user from authentication and the workspace. You cannot undo this action."
	confirmLabel="Delete user"
	onconfirm={confirmDelete}
	oncancel={() => (deleteId = null)}
/>
