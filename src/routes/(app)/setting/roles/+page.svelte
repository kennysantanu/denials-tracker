<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import type { PageData } from './$types';

	export let data: PageData;

	// SuperForm forms
	const { form: newRoleForm, constraints: newRoleFormConstraints } = superForm(data.newRoleForm);
</script>

<h2 class="h2 text-tertiary-500">List of Roles</h2>
<ol class="space-y-4">
	{#each data.roles as role}
		<li class="list-inside list-decimal">{role.role_name}</li>
	{/each}
</ol>

<hr />

<form action="?/createRole" method="post" class="space-y-4">
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
