<script lang="ts">
	import Pencil from '$lib/icons/Pencil-square.svelte';
	import { enhance } from '$app/forms';
	import type { SvelteComponent } from 'svelte';

	// Stores
	import { getModalStore } from '@skeletonlabs/skeleton';

	// Props
	/** Exposes parent props to this component. */
	export let parent: SvelteComponent;

	const modalStore = getModalStore();

	// Local Variable
	let isEdit = false;

	// Form Data
	let formData: Record<string, any> = {
		id: $modalStore[0]?.meta?.insurance?.id ?? null,
		name: $modalStore[0]?.meta?.insurance?.name ?? '',
		note: $modalStore[0]?.meta?.insurance?.note ?? ''
	};

	// Base Classes
	const cBase = 'card p-4 w-modal shadow-xl space-y-4';
	const cHeader = 'text-2xl font-bold';
	const cForm = 'border border-surface-500 p-4 space-y-4 rounded-container-token';
</script>

{#if $modalStore[0]}
	<div class="modal-example-form {cBase}">
		{#if !isEdit}
			<div class="flex items-center justify-between">
				<header class="{cHeader} text-left">{formData.name ?? '(name missing)'}</header>
				<button
					type="button"
					class="ml-4 text-tertiary-500"
					tabindex="-1"
					on:click={() => {
						isEdit = !isEdit;
					}}><Pencil /></button
				>
			</div>
			<div class="whitespace-pre-wrap">{formData.note}</div>
		{:else}
			<form
				action="setting/manage/insurances?/updateInsurance"
				method="post"
				id="updateInsuranceForm"
				class="modal-form {cForm}"
				use:enhance={({}) => {
					return async ({ result, update }) => {
						if (result.type === 'success') {
							formData = result.data?.form?.data;
							isEdit = false;
							update();
						}
					};
				}}
			>
				<input type="hidden" name="id" value={formData.id} />
				<label class="label">
					<span class="text-tertiary-500">Insurance Name</span>
					<input class="input" type="text" name="name" value={formData.name} />
				</label>
				<label class="label">
					<span class="text-tertiary-500">Notes</span>
					<textarea class="textarea" name="note" value={formData.note} rows="8"></textarea>
				</label>
				<div class="space-x-4">
					<button type="submit" class="variant-filled-primary btn">Save</button>
					<button
						class="variant-filled-secondary btn"
						on:click={() => {
							isEdit = false;
						}}>Cancel</button
					>
				</div>
			</form>
		{/if}
		<!-- prettier-ignore -->
		<footer class="modal-footer {parent.regionFooter}">
			<button class="btn {parent.buttonNeutral}" on:click={parent.onClose}>Close</button>
		</footer>
	</div>
{/if}
