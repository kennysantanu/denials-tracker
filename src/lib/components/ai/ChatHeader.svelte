<script lang="ts">
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Maximize2 from '@lucide/svelte/icons/maximize-2';
	import Minimize2 from '@lucide/svelte/icons/minimize-2';
	import X from '@lucide/svelte/icons/x';
	import ChatThreadSwitcher from './ChatThreadSwitcher.svelte';
	import type { ChatThread } from '$lib/stores/chatStore.svelte';

	interface Props {
		threads: ChatThread[];
		activeThreadId: string | null;
		isFullscreen: boolean;
		showFullscreenToggle: boolean;
		onSelectThread: (threadId: string) => void;
		onNewChat: () => void;
		onClear: () => void;
		onToggleFullscreen: () => void;
		onClose: () => void;
	}

	let {
		threads,
		activeThreadId,
		isFullscreen,
		showFullscreenToggle,
		onSelectThread,
		onNewChat,
		onClear,
		onToggleFullscreen,
		onClose
	}: Props = $props();
</script>

<div class="flex h-14 shrink-0 items-center justify-between border-b border-surface-200 px-4">
	<div class="flex flex-1 items-center gap-1 min-w-0">
		<MessageSquare class="h-4 w-4 text-primary-500 shrink-0" />
		<h2 id="ai-chat-title" class="sr-only">AI Assistant</h2>
		<ChatThreadSwitcher {threads} {activeThreadId} onSelect={onSelectThread} />
	</div>
	<div class="flex items-center gap-1 shrink-0">
		<button
			type="button"
			class="btn btn-sm hover:preset-tonal"
			aria-label="New chat"
			onclick={onNewChat}
		>
			<Plus class="h-4 w-4" />
		</button>
		<button
			type="button"
			class="btn btn-sm hover:preset-tonal"
			aria-label="Clear chat"
			onclick={onClear}
		>
			<Trash2 class="h-4 w-4" />
		</button>
		{#if showFullscreenToggle}
			<button
				type="button"
				class="btn btn-sm hover:preset-tonal"
				aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
				onclick={onToggleFullscreen}
			>
				{#if isFullscreen}
					<Minimize2 class="h-4 w-4" />
				{:else}
					<Maximize2 class="h-4 w-4" />
				{/if}
			</button>
		{/if}
		<button
			type="button"
			class="btn btn-sm hover:preset-tonal"
			aria-label="Close"
			onclick={onClose}
		>
			<X class="h-4 w-4" />
		</button>
	</div>
</div>
