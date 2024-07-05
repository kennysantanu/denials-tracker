<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import type { PageData } from './$types';

	export let data: PageData;

	// SuperForm forms
	const {
		form: newRoleForm,
		constraints: newRoleFormConstraints,
		enhance: newRoleFormEnhanced
	} = superForm(data.newRoleForm, {
		id: 'createRoleForm'
	});

	const {
		form: editRoleForm,
		constraints: editRoleFormConstraints,
		enhance: editRoleFormEnhanced
	} = superForm(data.editRoleForm, {
		id: 'editRoleForm'
	});
</script>

<h2 class="h2 text-tertiary-500">List of Roles</h2>
<ol class="space-y-4">
	{#each data.roles as role}
		<li class="list-inside list-decimal">{role.role_name}</li>
	{/each}
</ol>

<hr />

<form
	action="?/createRole"
	method="post"
	id="createRoleForm"
	class="space-y-4"
	use:newRoleFormEnhanced
>
	<h2 class="h2 text-tertiary-500">Create New Role</h2>
	<label class="label">
		<span class="text-tertiary-500">Role Name</span>
		<input
			type="text"
			name="role_name"
			class="input"
			bind:value={$newRoleForm.role_name}
			{...$newRoleFormConstraints.role_name}
		/>
	</label>
	<div class="space-x-4">
		<button type="submit" class="variant-filled-primary btn">Create Role</button>
	</div>
</form>

<hr />

<form
	action="?/updateRole"
	method="post"
	id="editRoleForm"
	class="space-y-4"
	use:editRoleFormEnhanced
>
	<h2 class="h2 text-tertiary-500">Edit Role</h2>
	<label class="label">
		<span class="text-tertiary-500">Role Select</span>
		<select class="select" name="id" bind:value={$editRoleForm.id} {...$editRoleFormConstraints.id}>
			{#each data.roles as role}
				<option value={role.id}>{role.role_name}</option>
			{/each}
		</select>
	</label>
	<label class="label">
		<span class="text-tertiary-500">Role Name</span>
		<input
			type="text"
			name="role_name"
			class="input"
			bind:value={$editRoleForm.role_name}
			{...$editRoleFormConstraints.role_name}
		/>
	</label>
	<div class="space-x-4">
		<button type="submit" class="variant-filled-primary btn">Edit Role</button>
	</div>
</form>
