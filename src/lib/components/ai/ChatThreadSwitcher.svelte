<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import type { ChatThread } from '$lib/stores/chatStore.svelte';

	interface Props {
		threads: ChatThread[];
		activeThreadId: string | null;
		onSelect: (threadId: string) => void;
		onNewChat: () => void;
	}

	let { threads, activeThreadId, onSelect, onNewChat }: Props = $props();

	let open = $state(false);

	function toggle() {
		open = !open;
	}

	function close() {
		open = false;
	}

	function select(threadId: string) {
		onSelect(threadId);
		close();
	}

	function newChat() {
		onNewChat();
		close();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	const activeTitle = $derived(
		activeThreadId
			? (threads.find((t) => t.id === activeThreadId)?.title ?? 'New chat')
			: 'New chat'
	);

	function timeAgo(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	// Close on outside click
	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.thread-switcher')) close();
	}

	$effect(() => {
		if (open) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="thread-switcher relative" onkeydown={handleKeydown}>
	<button
		type="button"
		class="flex items-center gap-1 text-sm font-semibold text-surface-800 hover:text-surface-900"
		onclick={toggle}
		aria-haspopup="listbox"
		aria-expanded={open}
	>
		<span class="max-w-40 truncate">{activeTitle}</span>
		<ChevronDown class="h-3.5 w-3.5 transition-transform {open ? 'rotate-180' : ''}" />
	</button>

	{#if open}
		<div
			class="absolute left-0 top-full z-10 mt-1 min-w-52 rounded-container border border-surface-200 bg-white py-1 shadow-lg"
			role="listbox"
		>
			<button
				type="button"
				class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary-600 hover:bg-surface-100"
				onclick={newChat}
			>
				<Plus class="h-4 w-4" />
				New chat
			</button>
			{#if threads.length > 0}
				<div class="my-1 border-t border-surface-100"></div>
				{#each threads as thread (thread.id)}
					<button
						type="button"
						class="w-full px-3 py-2 text-left text-sm hover:bg-surface-100 {thread.id === activeThreadId ? 'preset-tonal-primary' : 'text-surface-700'}"
						onclick={() => select(thread.id)}
						role="option"
						aria-selected={thread.id === activeThreadId}
					>
						<div class="truncate">{thread.title}</div>
						<div class="text-xs text-surface-400">{timeAgo(thread.lastMessageAt)}</div>
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>
