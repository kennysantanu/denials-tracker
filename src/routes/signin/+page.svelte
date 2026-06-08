<script lang="ts">
	import { superForm } from 'sveltekit-superforms/client';
	import { toastError } from '$lib/toast';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed } = superForm(data.form, {
		resetForm: false,
		onResult({ result }) {
			if (result.type === 'failure') {
				const error = (result.data as Record<string, unknown>)?.error as string | undefined;
				if (error) toastError(error);
			}
		}
	});
</script>

<svelte:head>
	<title>Sign In | Denials Tracker</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-surface-50 px-4">
	<div class="w-full max-w-md space-y-6 card border border-surface-200 bg-white p-8 shadow-sm">
		<div class="text-center">
			<h1 class="text-2xl font-bold text-surface-900">Denials Tracker</h1>
			<p class="mt-2 text-sm text-surface-500">Sign in to your account</p>
		</div>

		<form method="POST" use:enhance class="space-y-4">
			<label class="label">
				<span class="label-text">Email</span>
				<input
					type="email"
					name="email"
					bind:value={$form.email}
					class="input"
					placeholder="you@example.com"
					required
				/>
				{#if $errors.email}
					<p class="text-xs text-error-500">{$errors.email}</p>
				{/if}
			</label>

			<label class="label">
				<span class="label-text">Password</span>
				<input
					type="password"
					name="password"
					bind:value={$form.password}
					class="input"
					placeholder="••••••••"
					required
				/>
				{#if $errors.password}
					<p class="text-xs text-error-500">{$errors.password}</p>
				{/if}
			</label>

			<button type="submit" disabled={$delayed} class="btn w-full preset-filled-primary-500">
				{#if $delayed}
					Signing in…
				{:else}
					Sign In
				{/if}
			</button>
		</form>
	</div>
</div>
