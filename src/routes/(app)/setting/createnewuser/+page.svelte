<script lang="ts">
	import { superForm } from 'sveltekit-superforms';

	export let data;

	// Client API:
	const { form } = superForm(data.form);
</script>

<!-- New User Form -->
<form method="POST" action="?/signup" class="space-y-8">
	<h2 class="h2 text-tertiary-500">Create New User</h2>
	<label class="label">
		<span class="text-tertiary-500">Username</span>
		<input type="text" name="username" class="input" placeholder="Enter new username" />
	</label>
	<label class="label">
		<span class="text-tertiary-500">Password</span>
		<input type="text" name="password" class="input" placeholder="Enter new password" />
	</label>
	<button type="submit" class="variant-filled-primary btn">Create User</button>
</form>
