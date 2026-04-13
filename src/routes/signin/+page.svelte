<script lang="ts">
	import { superForm } from 'sveltekit-superforms/client';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed } = superForm(data.form, {
		resetForm: false
	});

	// Server-level error (rate limit, invalid credentials)
	let serverError = $derived((data as Record<string, unknown>).error as string | undefined);
</script>

<svelte:head>
	<title>Sign In — Denials Tracker</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-surface-50 px-4">
	<div class="w-full max-w-md space-y-6 rounded-xl bg-white p-8 shadow-lg">
		<div class="text-center">
			<h1 class="text-2xl font-bold text-surface-900">Denials Tracker</h1>
			<p class="mt-2 text-sm text-surface-500">Sign in to your account</p>
		</div>

		{#if serverError}
			<div class="rounded-md bg-error-50 p-4 text-sm text-error-700">
				{serverError}
			</div>
		{/if}

		<!-- Standard use:enhance pattern for progressive enhancement (Phase 2.8.4) -->
		<form method="POST" use:enhance class="space-y-4">
			<label class="block">
				<span class="text-sm font-medium text-surface-700">Email</span>
				<input
					type="text"
					name="email"
					bind:value={$form.email}
					class="mt-1 block w-full rounded-md border border-surface-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
					placeholder="you@example.com"
					required
				/>
				{#if $errors.email}
					<p class="mt-1 text-sm text-error-500">{$errors.email}</p>
				{/if}
			</label>

			<label class="block">
				<span class="text-sm font-medium text-surface-700">Password</span>
				<input
					type="password"
					name="password"
					bind:value={$form.password}
					class="mt-1 block w-full rounded-md border border-surface-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
					placeholder="••••••••"
					required
				/>
				{#if $errors.password}
					<p class="mt-1 text-sm text-error-500">{$errors.password}</p>
				{/if}
			</label>

			<button
				type="submit"
				disabled={$delayed}
				class="w-full rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
			>
				{#if $delayed}
					Signing in…
				{:else}
					Sign In
				{/if}
			</button>
		</form>
	</div>
</div>
