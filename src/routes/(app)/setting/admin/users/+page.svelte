<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import type { PageData } from './$types';

	export let data: PageData;

	// SuperForm forms
	const { form: newUserForm, constraints: newUserFormConstraints } = superForm(data.newUserForm);
	const { form: resetUserPasswordForm, constraints: resetUserPasswordFormConstraints } = superForm(
		data.resetUserPasswordForm
	);
</script>

<h2 class="h2 text-tertiary-500">List of Users</h2>
<ol class="space-y-4">
	{#each data.usersData as user}
		<li class="list-inside list-decimal">{user.username}</li>
	{/each}
</ol>

<hr />

<form action="?/createUser" method="post" class="space-y-4">
	<h2 class="h2 text-tertiary-500">Create New User</h2>
	<label class="label">
		<span class="text-tertiary-500">User Name</span>
		<input
			type="text"
			name="username"
			class="input"
			bind:value={$newUserForm.username}
			{...$newUserFormConstraints.username}
		/>
	</label>
	<label class="label">
		<span class="text-tertiary-500">Password</span>
		<input
			type="password"
			name="password"
			class="input"
			bind:value={$newUserForm.password}
			{...$newUserFormConstraints.password}
		/>
	</label>
	<label class="label">
		<span class="text-tertiary-500">Role</span>
		<select
			name="role"
			class="select"
			bind:value={$newUserForm.role}
			{...$newUserFormConstraints.role}
		>
			{#each data.rolesData as role}
				<option value={role.id}>{role.role_name}</option>
			{/each}
		</select>
	</label>
	<div class="space-x-4">
		<button type="submit" class="variant-filled-primary btn">Create User</button>
	</div>
</form>

<hr />

<form action="?/resetUserPassword" method="post" id="resetUserPasswordForm" class="space-y-4">
	<h2 class="h2 text-tertiary-500">Reset User Password</h2>
	<label class="label">
		<span class="text-tertiary-500">User Select</span>
		<select
			class="select"
			name="username"
			bind:value={$resetUserPasswordForm.username}
			{...$resetUserPasswordFormConstraints.username}
		>
			{#each data.usersData as user}
				<option value={user.username}>{user.username}</option>
			{/each}
		</select>
	</label>
	<label class="label">
		<span class="text-tertiary-500">New Password</span>
		<input
			type="password"
			name="password"
			class="input"
			bind:value={$resetUserPasswordForm.password}
			{...$resetUserPasswordFormConstraints.password}
		/>
		<div class="space-x-4">
			<button type="submit" class="variant-filled-primary btn">Reset Password</button>
		</div>
	</label>
</form>
