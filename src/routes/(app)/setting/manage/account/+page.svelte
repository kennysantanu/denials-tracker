<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { toastSuccess, toastError } from '$lib/toast';
	import { page } from '$app/state';
	import { untrack } from 'svelte';

	let { data } = $props();

	const {
		form,
		errors,
		enhance: formEnhance
	} = superForm(
		untrack(() => data.form),
		{
			onResult({ result }) {
				if (result.type === 'success') {
					toastSuccess('Password updated successfully');
				} else if (result.type === 'failure') {
					toastError((result.data as any)?.error ?? 'Failed to update password');
				}
			}
		}
	);

	let user = $derived((page.data as any).user);
	let expired = $derived((data as any).expired);
</script>

<svelte:head>
	<title>Account Settings — Denials Tracker</title>
</svelte:head>

<div class="space-y-6">
	<header>
		<h2 class="text-xl font-semibold text-surface-900">Account</h2>
		<p class="text-sm text-surface-500">Update your account credentials.</p>
	</header>

	{#if expired}
		<div
			class="rounded-base border-l-4 border-error-500 bg-error-50 p-4 text-sm text-error-700"
			role="alert"
		>
			<p class="font-semibold">Your password has expired.</p>
			<p>Please change your password below to continue using the application.</p>
		</div>
	{/if}

	<!-- Profile -->
	<section
		class="card border border-surface-200 bg-white p-6 shadow-sm"
		aria-labelledby="profile-heading"
	>
		<h3 id="profile-heading" class="mb-4 text-base font-semibold text-surface-900">Profile</h3>
		<label class="label max-w-md">
			<span class="label-text">Email</span>
			<input class="input" type="email" value={user?.email ?? ''} disabled readonly />
		</label>
	</section>

	<!-- Change Password -->
	<section
		class="card border border-surface-200 bg-white p-6 shadow-sm"
		aria-labelledby="password-heading"
	>
		<h3 id="password-heading" class="mb-1 text-base font-semibold text-surface-900">
			Change password
		</h3>
		<p class="mb-4 text-sm text-surface-500">
			Use a strong password that you don't reuse elsewhere.
		</p>

		<form method="POST" action="?/changePassword" use:formEnhance class="max-w-md space-y-4">
			<label class="label">
				<span class="label-text">Current password</span>
				<input
					id="currentPassword"
					name="currentPassword"
					type="password"
					autocomplete="current-password"
					class="input {$errors.currentPassword ? 'input-error' : ''}"
					aria-invalid={$errors.currentPassword ? 'true' : undefined}
					bind:value={$form.currentPassword}
				/>
				{#if $errors.currentPassword}
					<p class="text-xs text-error-500">{$errors.currentPassword}</p>
				{/if}
			</label>

			<label class="label">
				<span class="label-text">New password</span>
				<input
					id="newPassword"
					name="newPassword"
					type="password"
					autocomplete="new-password"
					class="input {$errors.newPassword ? 'input-error' : ''}"
					aria-invalid={$errors.newPassword ? 'true' : undefined}
					bind:value={$form.newPassword}
				/>
				{#if $errors.newPassword}
					<p class="text-xs text-error-500">{$errors.newPassword}</p>
				{/if}
			</label>

			<label class="label">
				<span class="label-text">Confirm new password</span>
				<input
					id="confirmPassword"
					name="confirmPassword"
					type="password"
					autocomplete="new-password"
					class="input {$errors.confirmPassword ? 'input-error' : ''}"
					aria-invalid={$errors.confirmPassword ? 'true' : undefined}
					bind:value={$form.confirmPassword}
				/>
				{#if $errors.confirmPassword}
					<p class="text-xs text-error-500">{$errors.confirmPassword}</p>
				{/if}
			</label>

			<div class="flex justify-end">
				<button type="submit" class="btn preset-filled-primary-500"> Update password </button>
			</div>
		</form>
	</section>
</div>
