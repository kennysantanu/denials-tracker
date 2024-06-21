<script lang="ts">
	import { superForm } from 'sveltekit-superforms';

	export let data;

	let { session, supabase } = data
	$: ({ session, supabase } = data)

	const { form, errors, constraints, message } = superForm(data.form);
</script>

<div class="flex min-h-screen flex-col justify-center space-y-16 px-6 py-12 lg:px-8">
	<div class="sm:mx-auto sm:w-full sm:max-w-sm">
		<h2 class="h2 mt-10 text-center font-bold text-tertiary-500">Denials Tracker</h2>
	</div>

	{#if $message}<h3>{$message}</h3>{/if}

	<!-- Sign In Card -->
	<div class="card mt-10 px-8 py-8 sm:mx-auto sm:w-full sm:max-w-sm">
		<!-- Sign In Form -->
		<form method="POST" action="?/signin" class="flex flex-col space-y-8">
			<label class="label">
				<span class="text-tertiary-500">Username</span>
				<input
					type="text"
					name="username"
					class="input"
					placeholder="Enter your username"
					bind:value={$form.username}
				/>
			</label>
			<label class="label">
				<span class="text-tertiary-500">Password</span>
				<input
					type="password"
					name="password"
					class="input"
					placeholder="Enter your password"
					bind:value={$form.password}
				/>
			</label>
			<div class="flex justify-end space-x-4">
				<button type="submit" class="variant-filled-primary btn">Sign In</button>
				<a href="/" class="variant-filled-secondary btn">Cancel</a>
			</div>
		</form>
	</div>
</div>
