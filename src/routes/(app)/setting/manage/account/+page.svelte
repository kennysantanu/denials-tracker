<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import type { PageData } from './$types';

	export let data: PageData;

	// SuperForm forms
	const { form: updatePasswordForm, constraints: updatePasswordFormConstraints } = superForm(
		data.updatePasswordForm
	);
</script>

<form action="?/updatePassword" method="post" id="updatePasswordForm" class="space-y-4">
	<h2 class="h2 text-tertiary-500">Change Password</h2>
	<label class="label">
		<span class="text-tertiary-500">New password</span>
		<input
			type="text"
			name="password"
			class="input"
			bind:value={$updatePasswordForm.password}
			{...$updatePasswordFormConstraints.password}
		/>
	</label>
	<div class="space-x-4">
		<button type="submit" class="variant-filled-primary btn">Reset Password</button>
	</div>
</form>
