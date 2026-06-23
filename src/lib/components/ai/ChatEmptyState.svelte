<script lang="ts">
	interface Props {
		quickPrompts: string[];
		onPromptClick: (prompt: string) => void;
	}

	let { quickPrompts, onPromptClick }: Props = $props();
</script>

<div class="flex h-full flex-col items-center justify-center gap-4 px-2">
	<p class="text-center text-sm text-surface-400">
		Ask me about denials, appeals, or billing data.
	</p>
	<p class="text-center text-xs text-surface-400">
		I can analyze denials, draft appeals, and answer billing questions.
	</p>
	{#if quickPrompts.length > 0}
		<div class="w-full space-y-2">
			<p class="text-center text-xs text-surface-400">Quick prompts:</p>
			{#each quickPrompts as prompt (prompt)}
				<button
					type="button"
					onclick={() => onPromptClick(prompt)}
					class="w-full rounded-base border border-surface-200 px-3 py-2 text-left text-xs text-surface-600 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
				>
					{prompt}
				</button>
			{/each}
		</div>
	{/if}
</div>
