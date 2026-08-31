<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import FileSiblingList from './FileSiblingList.svelte';
	import type { FileViewSibling } from '$lib/server/db/files';

	interface Props {
		siblings: FileViewSibling[];
		currentFileName: string;
		onclose: () => void;
	}

	let { siblings, currentFileName, onclose }: Props = $props();

	let drawerEl: HTMLDivElement | undefined = $state();

	$effect(() => {
		drawerEl?.focus();
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex justify-end bg-black/40"
	onkeydown={(e) => e.key === 'Escape' && onclose()}
	onclick={(e) => {
		if (e.target === e.currentTarget) onclose();
	}}
>
	<div
		bind:this={drawerEl}
		tabindex="-1"
		class="h-full w-full max-w-xs overflow-y-auto bg-white p-4 shadow-xl focus:outline-none"
		role="dialog"
		aria-modal="true"
		aria-label="Files uploaded on this date"
	>
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold text-surface-600">Files</h2>
			<button
				type="button"
				class="text-surface-400 hover:text-surface-700"
				onclick={onclose}
				aria-label="Close"
			>
				<X class="h-5 w-5" />
			</button>
		</div>
		<FileSiblingList {siblings} {currentFileName} />
	</div>
</div>
