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
	<title>Preferences | Denials Tracker</title>
</svelte:head>

<div class="space-y-6">
	<header>
		<h2 class="text-xl font-semibold text-surface-900">Preferences</h2>
		<p class="text-sm text-surface-500">
			Personal overrides for system preferences. Leave blank to inherit the system default.
		</p>
	</header>

	{#if data.systemPreferences.length === 0}
		<div class="rounded-container border-2 border-dashed border-surface-200 p-8 text-center">
			<p class="text-sm text-surface-500">No preferences available.</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each data.systemPreferences as pref (pref.id)}
				<form
					method="POST"
					action="?/setPreference"
					use:enhance={() =>
						async ({ result, update }) => {
							handleResult()({ result });
							await update();
						}}
					class="card border border-surface-200 bg-white p-4 shadow-sm"
				>
					<input type="hidden" name="preference_id" value={pref.id} />
					<div class="flex flex-col gap-3 sm:flex-row sm:items-end">
						<label class="label flex-1" for="pref-{pref.id}">
							<span class="label-text">{pref.name}</span>
							<input
								id="pref-{pref.id}"
								name="value"
								type="text"
								value={userValues.get(pref.id) ?? pref.value ?? ''}
								class="input"
							/>
							<span class="text-xs text-surface-500">
								Type: <code>{pref.data_type ?? 'string'}</code> · System default:
								<code>{pref.value ?? '—'}</code>
							</span>
						</label>
						<button type="submit" class="btn preset-filled-primary-500 btn-sm"> Save </button>
					</div>
				</form>
			{/each}
		</div>
	{/if}
</div>
