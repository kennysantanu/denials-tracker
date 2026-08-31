<script lang="ts">
	import { superForm } from 'sveltekit-superforms/client';

	let { data } = $props();

	let serverError = $state<string | null>(null);
	let showPassword = $state(false);

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed } = superForm(data.form, {
		resetForm: false,
		onSubmit() {
			serverError = null;
		},
		onResult({ result }) {
			if (result.type === 'failure') {
				const error = (result.data as Record<string, unknown>)?.error as string | undefined;
				serverError = error ?? 'Sign in failed. Please try again.';
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

		<form method="POST" use:enhance class="space-y-4" aria-busy={$delayed}>
			<input type="hidden" name="redirectTo" value={data.redirectTo} />

			{#if serverError}
				<div
					role="alert"
					class="rounded-md border border-error-300 bg-error-50 px-3 py-2 text-sm text-error-700"
				>
					{serverError}
				</div>
			{/if}

			<label class="label">
				<span class="label-text">Email</span>
				<input
					type="email"
					name="email"
					bind:value={$form.email}
					class="input"
					placeholder="you@example.com"
					autocomplete="email"
					disabled={$delayed}
					required
				/>
				{#if $errors.email}
					<p class="text-xs text-error-500">{$errors.email}</p>
				{/if}
			</label>

			<label class="label">
				<span class="label-text">Password</span>
				<div class="relative">
					<input
						type={showPassword ? 'text' : 'password'}
						name="password"
						bind:value={$form.password}
						class="input w-full pr-10"
						placeholder="••••••••"
						autocomplete="current-password"
						disabled={$delayed}
						required
					/>
					<button
						type="button"
						tabindex="-1"
						aria-label={showPassword ? 'Hide password' : 'Show password'}
						aria-pressed={showPassword}
						onclick={() => (showPassword = !showPassword)}
						class="absolute inset-y-0 right-0 flex items-center px-3 text-surface-400 hover:text-surface-600"
					>
						{#if showPassword}
							<!-- eye-off -->
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="h-4 w-4"
								aria-hidden="true"
							>
								<path
									d="M9.88 9.88a3 3 0 1 0 4.24 4.24"
								/>
								<path
									d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"
								/>
								<path
									d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"
								/>
								<line x1="2" x2="22" y1="2" y2="22" />
							</svg>
						{:else}
							<!-- eye -->
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="h-4 w-4"
								aria-hidden="true"
							>
								<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
								<circle cx="12" cy="12" r="3" />
							</svg>
						{/if}
					</button>
				</div>
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
