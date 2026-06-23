<script lang="ts">
	import DOMPurify from 'dompurify';
	import { marked } from 'marked';
	import Copy from '@lucide/svelte/icons/copy';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Pencil from '@lucide/svelte/icons/pencil';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import type { ChatMessage as ChatMessageType } from '$lib/stores/chatStore.svelte';

	interface Props {
		message: ChatMessageType;
		showRoundDivider?: boolean;
		onCopy?: (id: string) => void;
		onRetry?: () => void;
		onEdit?: (id: string, text: string) => void;
	}

	let { message, showRoundDivider = false, onCopy, onRetry, onEdit }: Props = $props();

	let toolExpanded = $state(false);
	let reasoningEl = $state<HTMLDivElement>();

	$effect(() => {
		if (message.reasoningContent && reasoningEl && message.status === 'streaming') {
			reasoningEl.scrollTop = reasoningEl.scrollHeight;
		}
	});

	function renderMarkdown(content: string): string {
		const raw = marked.parse(content);
		if (typeof raw === 'string') return DOMPurify.sanitize(raw);
		return '';
	}

	function handleCopy() {
		onCopy?.(message.id);
	}

	function handleRetry() {
		onRetry?.();
	}

	function handleEdit() {
		onEdit?.(message.id, message.content);
	}
</script>

{#if message.role === 'tool'}
	<!-- Round divider -->
	{#if showRoundDivider && message.round != null && message.round > 0}
		<div class="flex items-center gap-2 pt-1 pb-0.5">
			<div class="flex-1 border-t border-surface-200"></div>
			<span class="text-[10px] font-medium text-surface-400">
				Round {message.round + 1} of {message.maxRounds ?? 5}
			</span>
			<div class="flex-1 border-t border-surface-200"></div>
		</div>
	{/if}

	<!-- Tool call trace row (collapsed by default) -->
	<div class="flex justify-start">
		<div
			class="max-w-[85%] rounded-base border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs"
		>
			<button
				type="button"
				class="flex w-full items-center gap-1.5 text-left text-surface-500 hover:text-surface-700"
				onclick={() => (toolExpanded = !toolExpanded)}
			>
				<ChevronRight
					class="h-3 w-3 shrink-0 transition-transform {toolExpanded ? 'rotate-90' : ''}"
				/>
				{#if message.status === 'pending'}
					<Loader2 class="h-3 w-3 shrink-0 animate-spin text-primary-500" />
					<span class="text-surface-500">Calling {message.toolName ?? 'tool'}...</span>
				{:else if message.status === 'complete'}
					<span class="text-success-600">{message.toolName ?? 'Tool'} completed</span>
				{:else}
					<span>{message.toolName ?? 'Tool'} call</span>
				{/if}
			</button>
			{#if toolExpanded && message.content}
				<pre
					class="mt-1.5 max-h-48 overflow-y-auto text-[11px] whitespace-pre-wrap text-surface-600">{message.content}</pre>
			{/if}
		</div>
	</div>
{:else if message.role === 'user'}
	<div class="group flex justify-end">
		<div
			class="max-w-[85%] rounded-container border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900"
		>
			{message.content}

			<!-- Action buttons on hover -->
			<div
				class="mt-1.5 flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
			>
				<button
					type="button"
					class="btn btn-sm hover:preset-tonal"
					aria-label="Copy message"
					onclick={handleCopy}
				>
					<Copy class="h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					class="btn btn-sm hover:preset-tonal"
					aria-label="Edit message"
					onclick={handleEdit}
				>
					<Pencil class="h-3.5 w-3.5" />
				</button>
			</div>
		</div>
	</div>
{:else}
	<!-- Assistant message -->
	<div class="group flex justify-start">
		<div class="max-w-[85%] rounded-container border border-surface-200 bg-white px-3 py-2 text-sm">
			{#if message.reasoningContent}
				<details class="mb-2" open={message.status === 'streaming' || message.status === 'pending'}>
					<summary
						class="cursor-pointer text-xs text-surface-400 select-none hover:text-surface-600"
					>
						{#if message.status === 'streaming' || message.status === 'pending'}
							<Loader2 class="mr-1 inline h-3 w-3 animate-spin align-middle" />
						{/if}
						Thinking
					</summary>
					<div
						bind:this={reasoningEl}
						class="prose prose-sm mt-1.5 max-w-none overflow-y-auto border-l-2 border-surface-100 pl-3 text-xs text-surface-400 [&_b]:text-surface-400 [&_h1]:text-surface-400 [&_h2]:text-surface-400 [&_h3]:text-surface-400 [&_h4]:text-surface-400 [&_strong]:text-surface-400"
						class:max-h-14={message.status === 'streaming' || message.status === 'pending'}
					>
						{@html renderMarkdown(message.reasoningContent)}
					</div>
				</details>
			{/if}

			{#if message.status === 'pending' || message.status === 'streaming'}
				{#if message.content}
					<div class="prose prose-sm max-w-none">
						{@html renderMarkdown(message.content)}
					</div>
				{:else if !message.reasoningContent}
					<span class="text-surface-400">
						<Loader2 class="inline h-3 w-3 animate-spin align-middle" />
						Thinking...
					</span>
				{/if}
			{:else}
				<div class="prose prose-sm max-w-none">
					{@html renderMarkdown(message.content)}
				</div>
			{/if}

			<!-- Action buttons: visible on hover for complete messages -->
			{#if message.status === 'complete' || message.status === 'error' || message.status === 'cancelled'}
				<div
					class="mt-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
				>
					<button
						type="button"
						class="btn btn-sm hover:preset-tonal"
						aria-label="Copy message"
						onclick={handleCopy}
					>
						<Copy class="h-3.5 w-3.5" />
					</button>
					{#if message.status === 'error' || message.status === 'cancelled'}
						<button
							type="button"
							class="btn btn-sm hover:preset-tonal"
							aria-label="Retry"
							onclick={handleRetry}
						>
							<RefreshCw class="h-3.5 w-3.5" />
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
