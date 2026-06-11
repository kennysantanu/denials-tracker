<script lang="ts">
	import { Combobox } from '@skeletonlabs/skeleton-svelte';
	import { ListCollection } from '@zag-js/collection';
	import type { Database } from '$lib/supabase';

	type InsuranceRow = Database['public']['Tables']['insurances']['Row'];

	interface Props {
		insurances: InsuranceRow[];
		selected?: number[];
		name?: string;
	}

	let { insurances, selected = [], name = 'insurance_ids' }: Props = $props();

	let selectedValues: string[] = $state([]);

	// Sync prop → local state on mount / prop change
	$effect(() => {
		selectedValues = selected.map(String);
	});

	let inputValue = $state('');

	let filteredItems = $derived(
		inputValue
			? insurances.filter((ins) => ins.name.toLowerCase().includes(inputValue.toLowerCase()))
			: insurances
	);

	let filteredCollection = $derived(
		new ListCollection({
			items: filteredItems,
			itemToValue: (item) => String(item.id),
			itemToString: (item) => item.name
		})
	);

	let selectedInsurances = $derived(
		insurances.filter((ins) => selectedValues.includes(String(ins.id)))
	);

	function removeSelected(id: number) {
		selectedValues = selectedValues.filter((v) => v !== String(id));
	}
</script>

<fieldset>
	<legend class="mb-2 text-sm font-medium">Insurances</legend>

	{#if selectedInsurances.length > 0}
		<div class="mb-2 flex flex-wrap gap-1.5">
			{#each selectedInsurances as ins (ins.id)}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-700"
				>
					{ins.name}
					<button
						type="button"
						aria-label="Remove {ins.name}"
						class="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-primary-200"
						onclick={() => removeSelected(ins.id)}
					>
						<svg
							class="h-2.5 w-2.5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="3"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</span>
			{/each}
		</div>
	{/if}

	<Combobox
		collection={filteredCollection}
		multiple={true}
		value={selectedValues}
		onValueChange={(details) => {
			selectedValues = details.value;
		}}
		{inputValue}
		onInputValueChange={(details) => {
			inputValue = details.inputValue;
		}}
		openOnClick={true}
		inputBehavior="autohighlight"
		selectionBehavior="clear"
		placeholder="Search insurances..."
		closeOnSelect={true}
	>
		<Combobox.Control>
			<Combobox.Input
				class="w-full rounded border border-surface-300 bg-white px-3 py-2 text-sm placeholder:text-surface-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
			/>
		</Combobox.Control>

		<Combobox.Positioner>
			<Combobox.Content
				class="z-50 max-h-48 overflow-auto rounded-lg border border-surface-200 bg-white shadow-lg"
			>
				{#each filteredItems as ins (ins.id)}
					<Combobox.Item
						item={ins}
						class="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-surface-100 data-highlighted:bg-surface-100"
					>
						<Combobox.ItemIndicator>
							<svg
								class="h-4 w-4 text-primary-600"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
						</Combobox.ItemIndicator>
						<Combobox.ItemText>{ins.name}</Combobox.ItemText>
					</Combobox.Item>
				{/each}
				{#if filteredItems.length === 0}
					<div class="px-3 py-2 text-sm text-surface-400">No insurances found</div>
				{/if}
			</Combobox.Content>
		</Combobox.Positioner>
	</Combobox>

	{#each selectedValues as val (val)}
		<input type="hidden" {name} value={val} />
	{/each}
</fieldset>
