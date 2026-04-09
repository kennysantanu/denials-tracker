<script lang="ts">
	import { enhance } from '$app/forms';
	import { superForm } from 'sveltekit-superforms';
	import { toastSuccess, toastError } from '$lib/toast';
	import { page } from '$app/state';

	let { data } = $props();

	const { form, errors, enhance: formEnhance, message } = superForm(data.form, {
		onResult({ result }) {
			if (result.type === 'success') {
				toastSuccess('Password updated successfully');
			} else if (result.type === 'failure') {
				toastError((result.data as any)?.error ?? 'Failed to update password');
			}
		}
	});

	let user = $derived((page.data as any).user);
	let expired = $derived((data as any).expired);
</script>

<svelte:head>
	<title>Account Settings — Denials Tracker</title>
</svelte:head>

<div class="space-y-6">
	<h2 class="text-xl font-semibold text-surface-900">Account Settings</h2>

	{#if expired}
		<div class="rounded-md border border-red-300 bg-red-50 p-4">
			<p class="text-sm font-medium text-red-800">
				Your password has expired. Please change your password to continue using the application.
			</p>
		</div>
	{/if}

	<!-- Email (read-only) -->
	<div>
		<label class="mb-1 block text-sm font-medium text-surface-700">Email</label>
		<input
			type="email"
			value={user?.email ?? ''}
			disabled
			class="w-full max-w-md rounded-md border border-surface-300 bg-surface-100 px-3 py-2 text-sm text-surface-500"
		/>
	</div>

	<!-- Change Password Form -->
	<form method="POST" action="?/changePassword" use:formEnhance class="max-w-md space-y-4">
		<h3 class="text-lg font-medium text-surface-800">Change Password</h3>

		<div>
			<label for="currentPassword" class="mb-1 block text-sm font-medium text-surface-700"
				>Current Password</label
			>
			<input
				id="currentPassword"
				name="currentPassword"
				type="password"
				bind:value={$form.currentPassword}
				class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
			/>
			{#if $errors.currentPassword}
				<p class="mt-1 text-xs text-red-600">{$errors.currentPassword}</p>
			{/if}
		</div>

		<div>
			<label for="newPassword" class="mb-1 block text-sm font-medium text-surface-700"
				>New Password</label
			>
			<input
				id="newPassword"
				name="newPassword"
				type="password"
				bind:value={$form.newPassword}
				class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
			/>
			{#if $errors.newPassword}
				<p class="mt-1 text-xs text-red-600">{$errors.newPassword}</p>
			{/if}
		</div>

		<div>
			<label for="confirmPassword" class="mb-1 block text-sm font-medium text-surface-700"
				>Confirm Password</label
			>
			<input
				id="confirmPassword"
				name="confirmPassword"
				type="password"
				bind:value={$form.confirmPassword}
				class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
			/>
			{#if $errors.confirmPassword}
				<p class="mt-1 text-xs text-red-600">{$errors.confirmPassword}</p>
			{/if}
		</div>

		<button
			type="submit"
			class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
		>
			Update Password
		</button>
	</form>
</div>
