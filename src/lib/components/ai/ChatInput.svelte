<script lang="ts">
	import Send from '@lucide/svelte/icons/send';
	import Square from '@lucide/svelte/icons/square';
	import type { StoreStatus } from '$lib/stores/chatStore.svelte';

	interface Props {
		status: StoreStatus;
		onSend: (text: string) => void;
		onCancel: () => void;
		disabled?: boolean;
	}

	let { status, onSend, onCancel, disabled = false }: Props = $props();

	let text = $state('');
	let textareaEl = $state<HTMLTextAreaElement>();

	const isBusy = $derived(status === 'sending' || status === 'streaming');
	const charCount = $derived(text.length);
	const overLimit = $derived(charCount > 4000);

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	function handleSend() {
		const trimmed = text.trim();
		if (!trimmed || isBusy || overLimit) return;
		onSend(trimmed);
		text = '';
	}

	function handleCancel() {
		onCancel();
	}

	export function focus() {
		textareaEl?.focus();
	}
</script>

<div class="flex gap-2">
	{#if isBusy}
		<button
			type="button"
			class="btn preset-filled-error-500 w-full"
			onclick={handleCancel}
		>
			<Square class="h-4 w-4" />
			<span>Stop generating</span>
		</button>
	{:else}
		<textarea
			bind:this={textareaEl}
			bind:value={text}
			onkeydown={handleKeydown}
			placeholder="Type a message..."
			rows={3}
			disabled={disabled}
			class="input flex-1 resize-none text-sm"
		></textarea>
		<div class="flex flex-col items-end gap-1">
			<button
				type="button"
				class="btn preset-filled-primary-500 btn-sm"
				onclick={handleSend}
				disabled={!text.trim() || disabled}
			>
				<Send class="h-4 w-4" />
			</button>
			{#if charCount > 500}
				<span
					class="text-xs {overLimit ? 'text-error-500' : 'text-surface-400'}"
				>
					{charCount}/4000
				</span>
			{/if}
		</div>
	{/if}
</div>
