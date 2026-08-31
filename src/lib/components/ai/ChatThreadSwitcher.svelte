<script lang="ts">
	import { Combobox } from '@skeletonlabs/skeleton-svelte';
	import { ListCollection } from '@zag-js/collection';
	import type { ChatThread } from '$lib/stores/chatStore.svelte';

	interface Props {
		threads: ChatThread[];
		activeThreadId: string | null;
		onSelect: (threadId: string) => void;
	}

	let { threads, activeThreadId, onSelect }: Props = $props();

	let inputValue = $state('');
	let isOpen = $state(false);

	const filteredThreads = $derived(
		inputValue
			? threads.filter((t) => t.title.toLowerCase().includes(inputValue.toLowerCase()))
			: threads
	);

	const filteredCollection = $derived(
		new ListCollection({
			items: filteredThreads,
			itemToValue: (t) => t.id,
			itemToString: (t) => t.title
		})
	);

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
</script>

<Combobox
	collection={filteredCollection}
	multiple={false}
	value={activeThreadId ? [activeThreadId] : []}
	onValueChange={(details) => {
		if (details.value.length > 0) onSelect(details.value[0]);
	}}
	{inputValue}
	onInputValueChange={(details) => {
		inputValue = details.inputValue;
	}}
	onOpenChange={(details) => {
		isOpen = details.open;
	}}
	openOnClick={true}
	selectionBehavior="clear"
	placeholder={activeTitle}
	closeOnSelect={true}
>
	<Combobox.Control class="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1 transition-colors">
		<Combobox.Input
			class="w-full min-w-0 flex-1 truncate bg-transparent px-0 px-2 font-medium text-surface-700 placeholder:font-medium placeholder:text-surface-700"
		/>
		<Combobox.Trigger class="px-4" />
	</Combobox.Control>

	<Combobox.Positioner>
		<Combobox.Content class="z-50 max-h-72 min-w-64 overflow-auto">
			{#if filteredThreads.length === 0}
				<div class="px-3 py-2 text-sm text-surface-400">No threads found</div>
			{:else}
				{#each filteredThreads as thread (thread.id)}
					<Combobox.Item item={thread}>
						<Combobox.ItemText class="truncate"
							>{thread.title} ({timeAgo(thread.lastMessageAt)})</Combobox.ItemText
						>
						<Combobox.ItemIndicator></Combobox.ItemIndicator>
					</Combobox.Item>
				{/each}
			{/if}
		</Combobox.Content>
	</Combobox.Positioner>
</Combobox>
