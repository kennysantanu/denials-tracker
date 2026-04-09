<script lang="ts">
	import { enhance } from '$app/forms';
	import { toastSuccess, toastError } from '$lib/toast';

	let { data } = $props();

	// Build a map of user preference values keyed by preference_id
	let userValues = $derived(
		new Map(data.userPreferences.map((up: any) => [up.preference_id, up.user_value]))
	);

	function handleResult() {
		return ({ result }: any) => {
			if (result.type === 'success') {
				toastSuccess('Preference saved');
			} else if (result.type === 'failure') {
				toastError(result.data?.error ?? 'Failed to save preference');
			}
		};
	}
</script>

<svelte:head>
	<title>Preferences — Denials Tracker</title>
</svelte:head>

<div class="space-y-6">
	<h2 class="text-xl font-semibold text-surface-900">Preferences</h2>

	{#if data.systemPreferences.length === 0}
		<p class="text-sm text-surface-500">No preferences available.</p>
	{:else}
		<div class="space-y-4">
			{#each data.systemPreferences as pref (pref.id)}
				<form
					method="POST"
					action="?/setPreference"
					use:enhance={() => {
						return async ({ result, update }) => {
							handleResult()({ result });
							await update();
						};
					}}
					class="flex items-end gap-4 rounded-md border border-surface-200 bg-surface-50 p-4"
				>
					<input type="hidden" name="preference_id" value={pref.id} />
					<div class="flex-1">
						<label for="pref-{pref.id}" class="mb-1 block text-sm font-medium text-surface-700">
							{pref.name}
						</label>
						<p class="mb-2 text-xs text-surface-500">Type: {pref.data_type ?? 'string'}</p>
						<input
							id="pref-{pref.id}"
							name="value"
							type="text"
							value={userValues.get(pref.id) ?? pref.value ?? ''}
							class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm"
						/>
					</div>
					<button
						type="submit"
						class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
					>
						Save
					</button>
				</form>
			{/each}
		</div>
	{/if}
</div>
