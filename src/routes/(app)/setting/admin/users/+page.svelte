<script lang="ts">
	import { enhance } from '$app/forms';
	import { toastSuccess, toastError } from '$lib/toast';

	let { data } = $props();

	let showAddForm = $state(false);
	let editingId = $state<string | null>(null);
	let editRoleId = $state<number | undefined>(undefined);
	let resetPasswordId = $state<string | null>(null);
	let resetPasswordValue = $state('');
	let changeEmailId = $state<string | null>(null);
	let changeEmailValue = $state('');
	let changeUsernameId = $state<string | null>(null);
	let changeUsernameValue = $state('');

	function startEdit(user: any) {
		editingId = user.id;
		editRoleId = user.role ?? undefined;
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
				showAddForm = false;
				editingId = null;
				resetPasswordId = null;
				changeEmailId = null;
				changeUsernameId = null;
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
