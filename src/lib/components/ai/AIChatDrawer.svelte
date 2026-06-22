<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getChatContext,
		isChatDrawerOpen,
		closeChatDrawer
	} from '$lib/stores/chatContext.svelte';
	import {
		initChatStore,
		getMessages,
		getThreads,
		getActiveThreadId,
		getStatus,
		getError,
		loadThread,
		startNewThread,
		send,
		cancel,
		copyMessage,
		clearThread
	} from '$lib/stores/chatStore.svelte';
	import ChatHeader from './ChatHeader.svelte';
	import ChatMessageList from './ChatMessageList.svelte';
	import ChatMessage from './ChatMessage.svelte';
	import ChatInput from './ChatInput.svelte';
	import ChatEmptyState from './ChatEmptyState.svelte';
	import ChatDrawerBackdrop from './ChatDrawerBackdrop.svelte';
	import type { ChatMessage as ChatMessageType } from '$lib/stores/chatStore.svelte';

	// ── Local state ───────────────────────────────────────────────

	let drawerWidth = $state(400);
	let isSmallScreen = $state(false);
	let isFullscreen = $state(false);
	let isResizing = $state(false);
	let dialogEl = $state<HTMLDivElement>();
	let chatInputRef = $state<{ focus: () => void }>();
	let previousFocus = $state<HTMLElement | null>(null);

	// ── Reactively subscribe to stores ────────────────────────────

	const context = $derived(getChatContext());
	const messages: ChatMessageType[] = $derived(getMessages());
	const threads = $derived(getThreads());
	const activeThreadId = $derived(getActiveThreadId());
	const chatStatus = $derived(getStatus());
	const chatError = $derived(getError());
	const open = $derived(isChatDrawerOpen());

	// ── Derived values ────────────────────────────────────────────

	const fullscreenMode = $derived(isSmallScreen || isFullscreen);
	const isStreaming = $derived(chatStatus === 'streaming' || chatStatus === 'sending');
	const isEmpty = $derived(messages.length === 0);

	const quickPrompts = $derived(
		context.patientId
			? [
					"Summarize this patient's open denials",
					'Which denials need follow-up soon?',
					'Draft an appeal letter for the most recent denial'
				]
			: []
	);

	// ── Lifecycle ─────────────────────────────────────────────────

	onMount(() => {
		// Restore width + fullscreen prefs
		const savedWidth = localStorage.getItem('aiChatDrawerWidth');
		if (savedWidth) drawerWidth = Math.max(320, Math.min(800, parseInt(savedWidth, 10)));

		isFullscreen = localStorage.getItem('aiChatFullscreen') === 'true';

		// Init chat store (loads threads, restores active thread)
		initChatStore();

		// Media query for small screens
		const mq = window.matchMedia('(max-width: 640px)');
		isSmallScreen = mq.matches;
		const handler = (e: MediaQueryListEvent) => (isSmallScreen = e.matches);
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	});

	// Focus management: focus input on open, restore on close
	$effect(() => {
		if (open) {
			previousFocus = document.activeElement as HTMLElement | null;
			requestAnimationFrame(() => chatInputRef?.focus());
		} else {
			previousFocus?.focus();
			previousFocus = null;
		}
	});

	// ── Handlers ──────────────────────────────────────────────────

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closeChatDrawer();
			return;
		}
		// Focus trap
		if (e.key === 'Tab' && dialogEl) {
			const focusable = dialogEl.querySelectorAll<HTMLElement>(
				'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
			);
			if (focusable.length === 0) return;
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last?.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first?.focus();
			}
		}
	}

	function handleSend(text: string) {
		send(text);
	}

	function handleCancel() {
		cancel();
	}

	function handleClear() {
		clearThread();
	}

	function handleCopy(messageId: string) {
		copyMessage(messageId);
	}

	function handlePromptClick(prompt: string) {
		send(prompt);
	}

	function handleToggleFullscreen() {
		isFullscreen = !isFullscreen;
		localStorage.setItem('aiChatFullscreen', String(isFullscreen));
	}

	function handleSelectThread(threadId: string) {
		loadThread(threadId);
	}

	function handleNewChat() {
		startNewThread();
	}

	// ── Resize handle (side-panel mode only) ─────────────────────

	function onResizeStart(e: PointerEvent) {
		if (fullscreenMode) return;
		isResizing = true;
		const startX = e.clientX;
		const startWidth = drawerWidth;

		function onMove(ev: PointerEvent) {
			const delta = startX - ev.clientX;
			drawerWidth = Math.max(320, Math.min(800, startWidth + delta));
		}

		function onUp() {
			isResizing = false;
			localStorage.setItem('aiChatDrawerWidth', String(drawerWidth));
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
		}

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}
</script>

{#if open}
	<!-- Backdrop for fullscreen/mobile -->
	{#if fullscreenMode}
		<ChatDrawerBackdrop onclick={closeChatDrawer} />
	{/if}

	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={dialogEl}
		class="z-50 flex flex-col bg-white {fullscreenMode
			? 'fixed inset-0'
			: 'fixed top-0 right-0 h-full border-l border-surface-200 shadow-xl'}"
		style={fullscreenMode ? '' : `width: ${drawerWidth}px`}
		role="dialog"
		aria-modal="true"
		aria-labelledby="ai-chat-title"
		tabindex="-1"
		onkeydown={handleKeydown}
	>
		<!-- Resize handle: side-panel mode only -->
		{#if !fullscreenMode}
			<button
				type="button"
				class="absolute top-0 left-0 h-full w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-primary-200"
				onpointerdown={onResizeStart}
				aria-label="Resize chat panel"
			></button>
		{/if}

		<!-- Header -->
		<ChatHeader
			{threads}
			{activeThreadId}
			isFullscreen={isFullscreen}
			showFullscreenToggle={!isSmallScreen}
			onSelectThread={handleSelectThread}
			onNewChat={handleNewChat}
			onClear={handleClear}
			onToggleFullscreen={handleToggleFullscreen}
			onClose={closeChatDrawer}
		/>

		<!-- Messages -->
		<ChatMessageList {messages} {isStreaming} {isEmpty}>
			{#snippet emptyState()}
				<ChatEmptyState {quickPrompts} onPromptClick={handlePromptClick} />
			{/snippet}
			{#snippet children(args)}
				{@const prevMsg = args.index > 0 ? messages[args.index - 1] : null}
				<ChatMessage
					message={args.message}
					showRoundDivider={args.message.role === 'tool' && prevMsg?.role === 'tool' && (args.message.round ?? 0) !== (prevMsg?.round ?? 0)}
					onCopy={handleCopy}
				/>
			{/snippet}
		</ChatMessageList>

		<!-- Error banner -->
		{#if chatError}
			<div class="border-t border-error-200 bg-error-50 px-4 py-2 text-sm text-error-600">
				{chatError.message}
			</div>
		{/if}

		<!-- Input -->
		<div class="border-t border-surface-200 p-3">
			<ChatInput
				bind:this={chatInputRef}
				status={chatStatus}
				onSend={handleSend}
				onCancel={handleCancel}
			/>
		</div>
	</div>
{/if}
