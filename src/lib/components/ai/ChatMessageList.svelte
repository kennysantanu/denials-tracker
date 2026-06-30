<script lang="ts">
	import { type Snippet } from 'svelte';
	import { fly } from 'svelte/transition';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
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
	let isAtBottom = $state(true);

	const SCROLL_THRESHOLD = 80;

	function updateAtBottom() {
		if (!container) return;
		const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
		isAtBottom = distance <= SCROLL_THRESHOLD;
	}

	function scrollToBottom(smooth = true) {
		if (!container) return;
		container.scrollTo({
			top: container.scrollHeight,
			behavior: smooth ? 'smooth' : 'auto'
		});
		isAtBottom = true;
	}

	function handleScroll() {
		updateAtBottom();
	}

	// Auto-scroll on new messages and during streaming content growth.
	// Only auto-scroll when the user is already near the bottom.
	$effect(() => {
		// Track dependencies: message count and last message's content length
		// so streaming text growth triggers scroll.
		const len = messages.length;
		const lastContentLen = messages[len - 1]?.content.length ?? 0;
		const lastReasoningLen = messages[len - 1]?.reasoningContent?.length ?? 0;
		// Reference the values so the effect re-runs on change.
		void len;
		void lastContentLen;
		void lastReasoningLen;
		if (container && isAtBottom) {
			requestAnimationFrame(() => {
				if (container && isAtBottom) {
					container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
				}
			});
		}
	});

	// When a new user message is sent, force-scroll to bottom regardless.
	$effect(() => {
		const len = messages.length;
		if (len === 0) return;
		const last = messages[len - 1];
		if (last?.role === 'user') {
			isAtBottom = true;
			requestAnimationFrame(() => scrollToBottom(false));
		}
	});
</script>

<div class="relative flex-1 overflow-hidden">
	<div
		bind:this={container}
		class="h-full space-y-4 overflow-y-auto p-4"
		role="log"
		aria-live="polite"
		aria-relevant="additions"
		aria-busy={isStreaming}
		aria-label={isStreaming ? 'Assistant is responding' : undefined}
		onscroll={handleScroll}
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
					<div class="px-3 py-2 text-sm text-surface-400">
						<Loader2 class="inline h-4 w-4 animate-spin" />
					</div>
				</div>
			{/if}
		{/if}
	</div>

	{#if !isAtBottom && !isEmpty}
		<button
			type="button"
			class="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-base border border-surface-200 bg-white px-3 py-1.5 text-xs font-medium text-surface-600 shadow-md transition-colors hover:border-primary-300 hover:text-primary-700"
			onclick={() => scrollToBottom(true)}
			transition:fly={{ y: 8, duration: 150 }}
		>
			<ArrowDown class="h-3.5 w-3.5" />
			New messages
		</button>
	{/if}
</div>
