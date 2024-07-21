<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import type { PageData } from './$types';

	export let data: PageData;

	// SuperForm forms
	const { form, message, constraints, enhance } = superForm(data.form);
</script>

<div class="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8">
	<div class="sm:mx-auto sm:w-full sm:max-w-sm">
		<h1 class="h2 text-center font-bold text-tertiary-500">Create Administrator Account</h1>
	</div>

	<div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
		<form class="space-y-6" action="?/createAdmin" method="POST" use:enhance>
			<label class="label">
				<span class="text-tertiary-500">Username</span>
				<input
					type="text"
					name="username"
					class="input"
					value="admin"
					{...$constraints.username}
					disabled
				/>
			</label>
			<label class="label">
				<span class="text-tertiary-500">Password</span>
				<input
					type="password"
					name="password"
					class="input"
					bind:value={$form.password}
					{...$constraints.password}
				/>
			</label>
			<button type="submit" class="variant-filled-primary btn flex w-full justify-center"
				>Create Account</button
			>
			{#if $message}
				<p class="text-center">{$message}</p>
			{/if}
		</form>
	</div>
</div>
