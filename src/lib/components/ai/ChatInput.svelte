<script lang="ts">
	import { browser } from '$app/environment';
	import Send from '@lucide/svelte/icons/send';
	import Square from '@lucide/svelte/icons/square';
	import type { StoreStatus } from '$lib/stores/chatStore.svelte';

	interface Props {
		status: StoreStatus;
		onSend: (text: string) => void;
		onCancel: () => void;
		disabled?: boolean;
		placeholder?: string;
	}

	let {
		status,
		onSend,
		onCancel,
		disabled = false,
		placeholder = 'Type a message...'
	}: Props = $props();

	const DRAFT_KEY = 'aiChatDraft';
	const MAX_ROWS_PX = 160;
	const SINGLE_ROW_THRESHOLD = 44;

	let text = $state(browser ? (localStorage.getItem(DRAFT_KEY) ?? '') : '');
	let textareaEl = $state<HTMLTextAreaElement>();
	let isSingleRow = $state(true);

	const isBusy = $derived(status === 'sending' || status === 'streaming');
	const charCount = $derived(text.length);
	const overLimit = $derived(charCount > 4000);
	const canSend = $derived(text.trim().length > 0 && !isBusy && !overLimit && !disabled);

	// Restore draft height on mount / when textarea mounts
	$effect(() => {
		if (textareaEl && text) {
			requestAnimationFrame(() => autoGrow());
		}
	});

	function autoGrow() {
		if (!textareaEl) return;
		textareaEl.style.height = 'auto';
		const scrollH = textareaEl.scrollHeight;
		const targetH = Math.min(scrollH, MAX_ROWS_PX);
		// Enforce a minimum height of 40px so single-row textarea matches the btn height
		textareaEl.style.height = Math.max(targetH, 40) + 'px';
		isSingleRow = scrollH <= SINGLE_ROW_THRESHOLD;
	}

	function handleInput() {
		autoGrow();
		if (browser) localStorage.setItem(DRAFT_KEY, text);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	function handleSend() {
		const trimmed = text.trim();
		if (!canSend) return;
		onSend(trimmed);
		text = '';
		if (browser) localStorage.removeItem(DRAFT_KEY);
		if (textareaEl) {
			textareaEl.style.height = 'auto';
			isSingleRow = true;
		}
	}

	function handleCancel() {
		onCancel();
	}

	export function focus() {
		textareaEl?.focus();
	}
</script>

<div class={isSingleRow ? 'flex items-center gap-2' : 'space-y-2'}>
	<textarea
		bind:this={textareaEl}
		bind:value={text}
		oninput={handleInput}
		onkeydown={handleKeydown}
		{placeholder}
		rows={1}
		{disabled}
		aria-invalid={overLimit}
		class="input w-full flex-1 resize-none overflow-y-auto text-sm leading-relaxed placeholder:text-surface-400"
	></textarea>

	{#if isSingleRow}
		<!-- Inline icon-only button (send XOR cancel) -->
		{#if isBusy}
			<button
				type="button"
				class="btn self-stretch preset-tonal-error"
				aria-label="Stop generating"
				onclick={handleCancel}
			>
				<Square class="h-4 w-4" />
			</button>
		{:else}
			<button
				type="button"
				class="btn self-stretch preset-filled-primary-500"
				aria-label="Send message"
				onclick={handleSend}
				disabled={!canSend}
			>
				<Send class="h-4 w-4" />
			</button>
		{/if}
	{:else}
		<!-- Multi-row footer with char count + labeled button -->
		<div class="flex items-center justify-between gap-2">
			<span class="text-xs {overLimit ? 'text-error-500' : 'text-surface-400'}">
				{charCount}/4000

				{#if overLimit}
					(Message exceeds 4000 characters)
				{/if}
			</span>

			{#if isBusy}
				<button type="button" class="btn preset-tonal-error btn-sm" onclick={handleCancel}>
					<Square class="h-3.5 w-3.5" />
					<span>Stop</span>
				</button>
			{:else}
				<button
					type="button"
					class="btn preset-filled-primary-500 btn-sm"
					onclick={handleSend}
					disabled={!canSend}
				>
					<Send class="h-3.5 w-3.5" />
					<span>Send</span>
				</button>
			{/if}
		</div>
	{/if}
</div>
