<script lang="ts">
	import { type Snippet } from 'svelte';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import type { ChatMessage as ChatMessageType } from '$lib/stores/chatStore.svelte';

	interface Props {
		messages: ChatMessageType[];
		isStreaming: boolean;
		isEmpty: boolean;
		emptyState: Snippet;
		children: Snippet<[{ message: ChatMessageType; index: number }]>;
	}

	let { messages, isStreaming, isEmpty, emptyState, children }: Props = $props();

	let container = $state<HTMLDivElement>();

	// Auto-scroll on new messages
	$effect(() => {
		messages.length;
		if (container) {
			requestAnimationFrame(() => {
				container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
			});
		}
	});
</script>

<div
	bind:this={container}
	class="flex-1 space-y-4 overflow-y-auto p-4"
	role="log"
	aria-live="polite"
	aria-relevant="additions"
	aria-busy={isStreaming}
	aria-label={isStreaming ? 'Assistant is responding' : undefined}
>
	{#if isEmpty}
		{@render emptyState()}
	{:else}
		{#each messages as msg, i (msg.id)}
			{@render children({ message: msg, index: i })}
		{/each}
	{/if}

	{#if isStreaming && messages.length > 0}
		{@const lastMsg = messages[messages.length - 1]}
		{#if lastMsg.role === 'user' || (lastMsg.role === 'assistant' && lastMsg.status === 'streaming')}
			<!-- No extra loader — streaming content is handled by ChatMessage -->
		{:else if !lastMsg.content && !lastMsg.reasoningContent}
			<div class="flex justify-start">
				<div class="text-surface-400 px-3 py-2 text-sm">
					<Loader2 class="h-4 w-4 animate-spin inline" />
				</div>
			</div>
		{/if}
	{/if}
</div>
