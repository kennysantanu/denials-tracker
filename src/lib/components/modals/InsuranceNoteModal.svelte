<script lang="ts">
	import type { Database } from '$lib/supabase';
	import { enhance } from '$app/forms';
	import { toastSuccess, toastError } from '$lib/toast';
	import { invalidateAll } from '$app/navigation';

	type InsuranceRow = Database['public']['Tables']['insurances']['Row'];

	interface Props {
		insurance: InsuranceRow;
		canEdit: boolean;
		onclose: () => void;
	}

	let { insurance, canEdit, onclose }: Props = $props();

	let editMode = $state(false);
	let noteText = $state('');
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
	onkeydown={(e) => e.key === 'Escape' && onclose()}
	onclick={(e) => {
		if (e.target === e.currentTarget) onclose();
	}}
>
	<div
		class="mx-4 w-full max-w-md rounded-lg bg-white shadow-xl"
		role="dialog"
		aria-modal="true"
		aria-label="Insurance details"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-surface-200 px-5 py-4">
			<h3 class="text-lg font-semibold">{insurance.name}</h3>
			<button
				type="button"
				class="text-surface-400 hover:text-surface-700"
				onclick={onclose}
				aria-label="Close"
			>
				✕
			</button>
		</div>

		<!-- Body -->
		<div class="px-5 py-4">
			{#if editMode}
				<form
					method="POST"
					action="?/updateInsuranceNote"
					class="space-y-3"
					use:enhance={() => {
						return async ({ result, update }) => {
							if (result.type === 'success') {
								toastSuccess('Insurance note updated');
								editMode = false;
								await invalidateAll();
							} else if (result.type === 'failure') {
								toastError(
									'Error',
									(result.data as Record<string, string>)?.error || 'Update failed'
								);
								await update({ reset: false });
							}
						};
					}}
				>
					<input type="hidden" name="id" value={insurance.id} />
					<textarea
						name="note"
						class="textarea w-full"
						rows="4"
						placeholder="Enter insurance notes..."
						bind:value={noteText}
					></textarea>
					<div class="flex gap-2">
						<button type="submit" class="btn preset-filled-primary-500 btn-sm">Save</button>
						<button
							type="button"
							class="btn preset-outlined-surface-500 btn-sm"
							onclick={() => {
								editMode = false;
							}}
						>
							Cancel
						</button>
					</div>
				</form>
			{:else}
				<div class="space-y-3">
					<div>
						<p class="mb-1 text-xs font-medium text-surface-500">Note</p>
						{#if insurance.note}
							<p class="text-sm whitespace-pre-wrap text-surface-800">{insurance.note}</p>
						{:else}
							<p class="text-sm text-surface-400 italic">No note</p>
						{/if}
					</div>
					{#if canEdit}
						<button
							type="button"
							class="btn preset-outlined-primary-500 btn-sm"
							onclick={() => {
								noteText = insurance.note ?? '';
								editMode = true;
							}}
						>
							Edit Note
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
