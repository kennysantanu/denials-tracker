<script lang="ts">
	interface Option {
		value: number | string;
		label: string;
		bgColor?: string;
		txtColor?: string;
	}

	interface Props {
		options: Option[];
		selected: (number | string)[];
		placeholder: string;
	}

	let { options, selected = $bindable([]), placeholder }: Props = $props();

	let open = $state(false);
	let wrapperEl = $state<HTMLDivElement>();

	function toggle(value: number | string) {
		if (selected.includes(value)) {
			selected = selected.filter((v) => v !== value);
		} else {
			selected = [...selected, value];
		}
	}

	function handleDocClick(e: MouseEvent) {
		if (open && wrapperEl && !wrapperEl.contains(e.target as Node)) {
			open = false;
		}
	}
</script>

<svelte:document onclick={handleDocClick} />

<div class="relative" bind:this={wrapperEl}>
	<button
		type="button"
		class="rounded border border-surface-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
		onclick={() => (open = !open)}
	>
		{selected.length === 0 ? placeholder : `${selected.length} selected`}
		<span class="ml-1 text-xs text-surface-400">▾</span>
	</button>

	{#if open}
		<div
			class="absolute z-20 mt-1 max-h-52 min-w-full overflow-y-auto rounded border border-surface-200 bg-white shadow-md"
		>
			{#if options.length === 0}
				<p class="px-3 py-2 text-sm text-surface-400">No options</p>
			{:else}
				{#each options as opt (opt.value)}
					<label
						class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-50"
					>
						<input
							type="checkbox"
							checked={selected.includes(opt.value)}
							onchange={() => toggle(opt.value)}
							class="rounded"
						/>
						{#if opt.bgColor}
							<span
								class="rounded-full px-2 py-0.5 text-xs font-medium"
								style="background-color: {opt.bgColor}; color: {opt.txtColor ?? '#000'};"
							>
								{opt.label}
							</span>
						{:else}
							{opt.label}
						{/if}
					</label>
				{/each}
			{/if}
		</div>
	{/if}
</div>
