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
		id: 'createRoleForm',
		dataType: 'json'
	});

	const {
		form: editRoleForm,
		constraints: editRoleFormConstraints,
		enhance: editRoleFormEnhanced
	} = superForm(data.editRoleForm, {
		id: 'editRoleForm',
		dataType: 'json'
	});

	const {
		form: deleteRoleForm,
		constraints: deleteRoleFormConstraints,
		enhance: deleteRoleFormEnhanced
	} = superForm(data.deleteRoleForm, {
		id: 'deleteRoleForm',
		dataType: 'json',
		onSubmit({ formData, cancel }) {
			const roleName = data.roles.find((role) => role.id == formData.get('id'));
			if (
				!confirm(
					`Do you really want to remove ${roleName?.role_name}?\nAny user with this role will not have any permissions until they are assigned again in the Users setting.\nPlease note, this operation is irreversible!`
				)
			) {
				cancel();
			}
		}
	});

	// Functions
	const getRoles = async (id: number) => {
		const { data: rolesData, error } = await data.supabase
			.from('roles')
			.select('id, role_name, permissions')
			.eq('id', id)
			.single();

		if (error) {
			return;
		}

		editRoleForm.set(rolesData);
	};
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
	<label class="label">
		<span class="text-tertiary-500">Permissions</span>
		<div class="grid grid-cols-3 gap-4">
			<div>
				<p>Record page</p>
				<div class="space-y-2">
					<div>
						<label class="flex items-center space-x-2">
							<input
								class="checkbox"
								type="checkbox"
								name="denial_read"
								bind:checked={$newRoleForm.permissions.denial_read}
							/>
							<p>Read access</p>
						</label>
					</div>
					<div>
						<label class="flex items-center space-x-2">
							<input
								class="checkbox"
								type="checkbox"
								name="denial_create"
								bind:checked={$newRoleForm.permissions.denial_create}
							/>
							<p>Create denial</p>
						</label>
						<label class="flex items-center space-x-2">
							<input
								class="checkbox"
								type="checkbox"
								name="denial_edit"
								bind:checked={$newRoleForm.permissions.denial_edit}
							/>
							<p>Edit denial</p>
						</label>
						<label class="flex items-center space-x-2">
							<input
								class="checkbox"
								type="checkbox"
								name="denial_delete"
								bind:checked={$newRoleForm.permissions.denial_delete}
							/>
							<p>Delete denial</p>
						</label>
					</div>
					<div>
						<label class="flex items-center space-x-2">
							<input
								class="checkbox"
								type="checkbox"
								name="note_create"
								bind:checked={$newRoleForm.permissions.note_create}
							/>
							<p>Create note</p>
						</label>
						<label class="flex items-center space-x-2">
							<input
								class="checkbox"
								type="checkbox"
								name="note_edit"
								bind:checked={$newRoleForm.permissions.note_edit}
							/>
							<p>Edit note</p>
						</label>
						<label class="flex items-center space-x-2">
							<input
								class="checkbox"
								type="checkbox"
								name="note_delete"
								bind:checked={$newRoleForm.permissions.note_delete}
							/>
							<p>Delete note</p>
						</label>
					</div>
					<div>
						<label class="flex items-center space-x-2">
							<input
								class="checkbox"
								type="checkbox"
								name="attachment_add"
								bind:checked={$newRoleForm.permissions.attachment_add}
							/>
							<p>Add attachment</p>
						</label>
						<label class="flex items-center space-x-2">
							<input
								class="checkbox"
								type="checkbox"
								name="attachment_remove"
								bind:checked={$newRoleForm.permissions.attachment_remove}
							/>
							<p>Remove attachment</p>
						</label>
					</div>
				</div>
			</div>
			<div>
				<p>File page</p>
				<div class="space-y-2">
					<div>
						<label class="flex items-center space-x-2">
							<input
								class="checkbox"
								type="checkbox"
								name="file_read"
								bind:checked={$newRoleForm.permissions.file_read}
							/>
							<p>Read access</p>
						</label>
					</div>
					<div>
						<label class="flex items-center space-x-2">
							<input
								class="checkbox"
								type="checkbox"
								name="file_upload"
								bind:checked={$newRoleForm.permissions.file_upload}
							/>
							<p>Upload file</p>
						</label>
						<label class="flex items-center space-x-2">
							<input
								class="checkbox"
								type="checkbox"
								name="file_edit"
								bind:checked={$newRoleForm.permissions.file_edit}
							/>
							<p>Edit file</p>
						</label>
						<label class="flex items-center space-x-2">
							<input
								class="checkbox"
								type="checkbox"
								name="file_delete"
								bind:checked={$newRoleForm.permissions.file_delete}
							/>
							<p>Delete file</p>
						</label>
					</div>
				</div>
			</div>
			<div>
				<p>Admin page</p>
				<div class="space-y-2">
					<div>
						<label class="flex items-center space-x-2">
							<input
								class="checkbox"
								type="checkbox"
								name="admin_read"
								bind:checked={$newRoleForm.permissions.admin_read}
							/>
							<p>Read access</p>
						</label>
					</div>
				</div>
			</div>
		</div>
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
		<select
			class="select"
			name="id"
			bind:value={$editRoleForm.id}
			{...$editRoleFormConstraints.id}
			on:change={() => getRoles($editRoleForm.id)}
		>
			{#each data.roles as role}
				<option value={role.id}>{role.role_name}</option>
			{/each}
		</select>
	</label>
	{#if $editRoleForm.id !== 0}
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
		<label class="label">
			<span class="text-tertiary-500">Permissions</span>
			<div class="grid grid-cols-3 gap-4">
				<div>
					<p>Record page</p>
					<div class="space-y-2">
						<div>
							<label class="flex items-center space-x-2">
								<input
									class="checkbox"
									type="checkbox"
									name="denial_read"
									bind:checked={$editRoleForm.permissions.denial_read}
								/>
								<p>Read access</p>
							</label>
						</div>
						<div>
							<label class="flex items-center space-x-2">
								<input
									class="checkbox"
									type="checkbox"
									name="denial_create"
									bind:checked={$editRoleForm.permissions.denial_create}
								/>
								<p>Create denial</p>
							</label>
							<label class="flex items-center space-x-2">
								<input
									class="checkbox"
									type="checkbox"
									name="denial_edit"
									bind:checked={$editRoleForm.permissions.denial_edit}
								/>
								<p>Edit denial</p>
							</label>
							<label class="flex items-center space-x-2">
								<input
									class="checkbox"
									type="checkbox"
									name="denial_delete"
									bind:checked={$editRoleForm.permissions.denial_delete}
								/>
								<p>Delete denial</p>
							</label>
						</div>
						<div>
							<label class="flex items-center space-x-2">
								<input
									class="checkbox"
									type="checkbox"
									name="note_create"
									bind:checked={$editRoleForm.permissions.note_create}
								/>
								<p>Create note</p>
							</label>
							<label class="flex items-center space-x-2">
								<input
									class="checkbox"
									type="checkbox"
									name="note_edit"
									bind:checked={$editRoleForm.permissions.note_edit}
								/>
								<p>Edit note</p>
							</label>
							<label class="flex items-center space-x-2">
								<input
									class="checkbox"
									type="checkbox"
									name="note_delete"
									bind:checked={$editRoleForm.permissions.note_delete}
								/>
								<p>Delete note</p>
							</label>
						</div>
						<div>
							<label class="flex items-center space-x-2">
								<input
									class="checkbox"
									type="checkbox"
									name="attachment_add"
									bind:checked={$editRoleForm.permissions.attachment_add}
								/>
								<p>Add attachment</p>
							</label>
							<label class="flex items-center space-x-2">
								<input
									class="checkbox"
									type="checkbox"
									name="attachment_remove"
									bind:checked={$editRoleForm.permissions.attachment_remove}
								/>
								<p>Remove attachment</p>
							</label>
						</div>
					</div>
				</div>
				<div>
					<p>File page</p>
					<div class="space-y-2">
						<div>
							<label class="flex items-center space-x-2">
								<input
									class="checkbox"
									type="checkbox"
									name="file_read"
									bind:checked={$editRoleForm.permissions.file_read}
								/>
								<p>Read access</p>
							</label>
						</div>
						<div>
							<label class="flex items-center space-x-2">
								<input
									class="checkbox"
									type="checkbox"
									name="file_upload"
									bind:checked={$editRoleForm.permissions.file_upload}
								/>
								<p>Upload file</p>
							</label>
							<label class="flex items-center space-x-2">
								<input
									class="checkbox"
									type="checkbox"
									name="file_edit"
									bind:checked={$editRoleForm.permissions.file_edit}
								/>
								<p>Edit file</p>
							</label>
							<label class="flex items-center space-x-2">
								<input
									class="checkbox"
									type="checkbox"
									name="file_delete"
									bind:checked={$editRoleForm.permissions.file_delete}
								/>
								<p>Delete file</p>
							</label>
						</div>
					</div>
				</div>
				<div>
					<p>Admin page</p>
					<div class="space-y-2">
						<div>
							<label class="flex items-center space-x-2">
								<input
									class="checkbox"
									type="checkbox"
									name="admin_read"
									bind:checked={$editRoleForm.permissions.admin_read}
								/>
								<p>Read access</p>
							</label>
						</div>
					</div>
				</div>
			</div>
		</label>
		<div class="space-x-4">
			<button type="submit" class="variant-filled-primary btn">Edit Role</button>
		</div>
	{/if}
</form>

<hr />

<form
	action="?/deleteRole"
	method="post"
	id="deleteRoleForm"
	class="space-y-4"
	use:deleteRoleFormEnhanced
>
	<h2 class="h2 text-tertiary-500">Delete Role</h2>
	<label class="label">
		<span class="text-tertiary-500">Role Select</span>
		<select
			class="select"
			name="id"
			bind:value={$deleteRoleForm.id}
			{...$deleteRoleFormConstraints.id}
		>
			{#each data.roles as role}
				<option value={role.id}>{role.role_name}</option>
			{/each}
		</select>
	</label>
	<div class="space-x-4">
		<button type="submit" class="variant-filled-primary btn">Delete Role</button>
	</div>
</form>
