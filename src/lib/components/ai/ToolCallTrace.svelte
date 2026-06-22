<script lang="ts">
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import type { ChatMessage } from '$lib/stores/chatStore.svelte';

	interface Props {
		messages: ChatMessage[];
	}

	let { messages }: Props = $props();

	let expanded = $state<Set<string>>(new Set());

	function toggle(id: string) {
		expanded = new Set(expanded);
		if (expanded.has(id)) {
			expanded.delete(id);
		} else {
			expanded.add(id);
		}
	}

	// Group consecutive tool messages by round for dividers
	const groups = $derived(
		messages.reduce<
			{ round: number; maxRounds: number; items: ChatMessage[] }[]
		>((acc, msg) => {
			const r = msg.round ?? 0;
			const last = acc[acc.length - 1];
			if (last && last.round === r) {
				last.items.push(msg);
				if (msg.maxRounds) last.maxRounds = msg.maxRounds;
			} else {
				acc.push({ round: r, maxRounds: msg.maxRounds ?? 5, items: [msg] });
			}
			return acc;
		}, [])
	);

	const totalRounds = $derived(Math.max(...groups.map((g) => g.round), 0) + 1);
</script>

<div class="space-y-1 my-1">
	{#each groups as group}
		{#if group.round > 0}
			<div class="flex items-center gap-2 pt-1 pb-0.5">
				<div class="flex-1 border-t border-surface-200"></div>
				<span class="text-[10px] text-surface-400 font-medium">
					Round {group.round + 1} of {group.maxRounds}
				</span>
				<div class="flex-1 border-t border-surface-200"></div>
			</div>
		{/if}

		{#each group.items as msg (msg.id)}
			<div class="flex justify-start">
				<div class="rounded-base border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs max-w-[85%]">
					<button
						type="button"
						class="flex items-center gap-1.5 text-surface-500 hover:text-surface-700 w-full text-left"
						onclick={() => toggle(msg.id)}
					>
						<ChevronRight
							class="h-3 w-3 shrink-0 transition-transform {expanded.has(msg.id) ? 'rotate-90' : ''}"
						/>
						{#if msg.status === 'pending'}
							<Loader2 class="h-3 w-3 animate-spin text-primary-500 shrink-0" />
							<span class="text-surface-500">
								Calling {msg.toolName ?? 'tool'}...
							</span>
						{:else if msg.status === 'complete'}
							<span class="text-success-600">
								{msg.toolName ?? 'Tool'} completed
							</span>
						{:else if msg.status === 'error'}
							<span class="text-error-500">
								{msg.toolName ?? 'Tool'} failed
							</span>
						{:else}
							<span>{msg.toolName ?? 'Tool'} call</span>
						{/if}
					</button>
					{#if expanded.has(msg.id) && msg.content}
						<pre class="mt-1.5 max-h-48 overflow-y-auto text-[11px] text-surface-600 whitespace-pre-wrap">{msg.content}</pre>
					{/if}
				</div>
			</div>
		{/each}
	{/each}
</div>
