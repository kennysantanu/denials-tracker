<script lang="ts">
	import type { Database } from '$lib/supabase';

	type LabelRow = Database['public']['Tables']['labels']['Row'];

	interface Props {
		labels: LabelRow[];
		selected?: number[];
		name?: string;
	}

	let { labels, selected = [], name = 'label_ids' }: Props = $props();

	let selectedArr: number[] = $state([]);

	// Sync prop → local state (runs on mount and when prop changes)
	$effect(() => {
		selectedArr = [...selected];
	});

	let selectedIds = $derived(new Set(selectedArr));

	function toggle(id: number) {
		if (selectedIds.has(id)) {
			selectedArr = selectedArr.filter((v) => v !== id);
		} else {
			selectedArr = [...selectedArr, id];
		}
	}
</script>

<fieldset>
	<legend class="mb-2 text-sm font-medium">Labels</legend>
	<div class="flex flex-wrap gap-2">
		{#each labels as label (label.id)}
			<button
				type="button"
				class="inline-flex items-center gap-1 rounded-full border-2 px-3 py-1 text-xs font-medium transition-all select-none"
				class:opacity-40={!selectedIds.has(label.id)}
				class:scale-95={!selectedIds.has(label.id)}
				style="background-color: {label.bg_color}; color: {label.txt_color}; border-color: {selectedIds.has(
					label.id
				)
					? label.txt_color
					: 'transparent'};"
				onclick={() => toggle(label.id)}
			>
				{#if selectedIds.has(label.id)}
					<svg
						class="h-3 w-3"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="3"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				{/if}
				{label.label_name}
			</button>
		{/each}
	</div>
	{#each selectedArr as id (id)}
		<input type="hidden" {name} value={id} />
	{/each}
</fieldset>
