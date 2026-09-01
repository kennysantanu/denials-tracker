<script lang="ts">
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { SvelteSet } from 'svelte/reactivity';
	import type { ChatMessage } from '$lib/stores/chatStore.svelte';

	interface Props {
		messages: ChatMessage[];
	}

	let { messages }: Props = $props();

	const expanded = new SvelteSet<string>();

	// Friendly labels for the visible tool-call trace (plans/AI_TOOL_ARCHITECTURE_PLAN.md §13).
	const TOOL_LABELS: Record<string, string> = {
		search_patients: 'patient search',
		search_denials: 'denial search',
		search_wiki: 'wiki search'
	};

	function toolLabel(name: string | null | undefined): string {
		if (!name) return 'tool';
		return TOOL_LABELS[name] ?? name.replace(/_/g, ' ');
	}

	function capitalize(value: string): string {
		return value.charAt(0).toUpperCase() + value.slice(1);
	}

	function toggle(id: string) {
		if (expanded.has(id)) {
			expanded.delete(id);
		} else {
			expanded.add(id);
		}
	}

	// Group consecutive tool messages by round for dividers
	const groups = $derived(
		messages.reduce<{ round: number; maxRounds: number; items: ChatMessage[] }[]>((acc, msg) => {
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

<div class="my-1 space-y-1">
	{#each groups as group (group.round)}
		{#if group.round > 0}
			<div class="flex items-center gap-2 pt-1 pb-0.5">
				<div class="flex-1 border-t border-surface-200"></div>
				<span class="text-[10px] font-medium text-surface-400">
					Round {group.round + 1} of {group.maxRounds}
				</span>
				<div class="flex-1 border-t border-surface-200"></div>
			</div>
		{/if}

		{#each group.items as msg (msg.id)}
			<div class="flex justify-start">
				<div
					class="max-w-[85%] rounded-base border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs"
				>
					<button
						type="button"
						class="flex w-full items-center gap-1.5 text-left text-surface-500 hover:text-surface-700"
						onclick={() => toggle(msg.id)}
					>
						<ChevronRight
							class="h-3 w-3 shrink-0 transition-transform {expanded.has(msg.id)
								? 'rotate-90'
								: ''}"
						/>
						{#if msg.status === 'pending'}
							<Loader2 class="h-3 w-3 shrink-0 animate-spin text-primary-500" />
							<span class="text-surface-500">
								Calling {toolLabel(msg.toolName)}...
							</span>
						{:else if msg.status === 'complete'}
							<span class="text-success-600">
								{capitalize(toolLabel(msg.toolName))} completed
							</span>
						{:else if msg.status === 'error'}
							<span class="text-error-500">
								{capitalize(toolLabel(msg.toolName))} failed
							</span>
						{:else}
							<span>{capitalize(toolLabel(msg.toolName))} call</span>
						{/if}
					</button>
					{#if expanded.has(msg.id) && msg.content}
						<pre
							class="mt-1.5 max-h-48 overflow-y-auto text-[11px] whitespace-pre-wrap text-surface-600">{msg.content}</pre>
					{/if}
				</div>
			</div>
		{/each}
	{/each}
</div>
