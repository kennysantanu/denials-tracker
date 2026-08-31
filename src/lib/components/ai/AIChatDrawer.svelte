<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
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
		getContextMeta,
		loadThread,
		startNewThread,
		send,
		cancel,
		copyMessage,
		clearThread,
		retryLast,
		clearError
	} from '$lib/stores/chatStore.svelte';
	import { ConfirmDialog } from '$lib/components/ui';
	import ChatHeader from './ChatHeader.svelte';
	import ChatContextBar from './ChatContextBar.svelte';
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
	let showClearConfirm = $state(false);
	let touchStartX = $state(0);
	let touchStartY = $state(0);

	// ── Reactively subscribe to stores ────────────────────────────

	const context = $derived(getChatContext());
	const messages: ChatMessageType[] = $derived(getMessages());
	const threads = $derived(getThreads());
	const activeThreadId = $derived(getActiveThreadId());
	const chatStatus = $derived(getStatus());
	const chatError = $derived(getError());
	const contextMeta = $derived(getContextMeta());
	const open = $derived(isChatDrawerOpen());
	let allowedMixedPatientThread = $state(false);

	// ── Derived values ────────────────────────────────────────────

	const fullscreenMode = $derived(isSmallScreen || isFullscreen);
	const isStreaming = $derived(chatStatus === 'streaming' || chatStatus === 'sending');
	const isEmpty = $derived(messages.length === 0);
	const activeThreadPatientId = $derived(getThreadPatientId(messages));
	const showPatientBoundaryPrompt = $derived(
		messages.length > 0 &&
			context.patientId != null &&
			activeThreadPatientId != null &&
			activeThreadPatientId !== context.patientId &&
			!allowedMixedPatientThread
	);

	const patientPrompts = [
		"Summarize this patient's open denials",
		'Which denials need follow-up soon?',
		'Draft an appeal letter for the most recent denial'
	];

	const generalPrompts = [
		'Summarize recent denials across all patients',
		'Which appeals are overdue?',
		'Explain common denial reason codes',
		"What's our denial rate trend?"
	];

	const quickPrompts = $derived(context.patientId ? patientPrompts : generalPrompts);

	const inputPlaceholder = $derived(
		context.patientId
			? "Ask about this patient's denials…"
			: context.pageData
				? 'Ask about these records…'
				: 'Ask about denials, appeals, or billing…'
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

	// ── Handlers ──────────────────────────────────────────────────

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closeChatDrawer();
			return;
		}
		// Focus trap
		const dialogEl = document.getElementById('ai-chat-dialog');
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

	function handleCopy(messageId: string) {
		copyMessage(messageId);
	}

	function handleRetry() {
		retryLast();
	}

	function handleDismissError() {
		clearError();
	}

	function handlePromptClick(prompt: string) {
		send(prompt);
	}

	function handleToggleFullscreen() {
		isFullscreen = !isFullscreen;
		localStorage.setItem('aiChatFullscreen', String(isFullscreen));
	}

	function handleSelectThread(threadId: string) {
		allowedMixedPatientThread = false;
		loadThread(threadId);
	}

	function handleNewChat() {
		allowedMixedPatientThread = false;
		startNewThread();
	}

	function handleContinuePatientThread() {
		allowedMixedPatientThread = true;
	}

	function handleStartPatientThread() {
		startNewThread();
		allowedMixedPatientThread = false;
	}

	function handleRequestClear() {
		showClearConfirm = true;
	}

	function handleConfirmClear() {
		clearThread();
		showClearConfirm = false;
	}

	function handleCancelClear() {
		showClearConfirm = false;
	}

	// ── Resize handle (side-panel mode only) ─────────────────────

	const MIN_WIDTH = 320;
	const MAX_WIDTH = 1024;

	function onResizeStart(e: PointerEvent) {
		if (fullscreenMode) return;
		isResizing = true;
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
		const startX = e.clientX;
		const startWidth = drawerWidth;

		function onMove(ev: PointerEvent) {
			const delta = startX - ev.clientX;
			drawerWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + delta));
		}

		function onUp() {
			isResizing = false;
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
			localStorage.setItem('aiChatDrawerWidth', String(drawerWidth));
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
		}

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}

	function handleResizeKeydown(e: KeyboardEvent) {
		if (fullscreenMode) return;
		const step = e.shiftKey ? 64 : 16;
		if (e.key === 'ArrowLeft') {
			drawerWidth = Math.max(MIN_WIDTH, drawerWidth + step);
			localStorage.setItem('aiChatDrawerWidth', String(drawerWidth));
			e.preventDefault();
		} else if (e.key === 'ArrowRight') {
			drawerWidth = Math.min(MAX_WIDTH, drawerWidth - step);
			localStorage.setItem('aiChatDrawerWidth', String(drawerWidth));
			e.preventDefault();
		}
	}

	// ── Swipe-to-close (mobile/fullscreen only) ──────────────────

	function onTouchStart(e: TouchEvent) {
		if (!fullscreenMode || e.touches.length !== 1) return;
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
	}

	function onTouchEnd(e: TouchEvent) {
		if (!fullscreenMode) return;
		const touch = e.changedTouches[0];
		if (!touch) return;
		const deltaX = touch.clientX - touchStartX;
		const deltaY = touch.clientY - touchStartY;
		// Horizontal swipe right, dominant over vertical
		if (deltaX > 80 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
			closeChatDrawer();
		}
	}

	function getThreadPatientId(threadMessages: ChatMessageType[]): number | null {
		for (const message of threadMessages) {
			const snapshot = message.contextSnapshot as { patientId?: number } | undefined;
			if (typeof snapshot?.patientId === 'number') return snapshot.patientId;
		}
		return null;
	}
</script>

{#if open}
	<!-- Backdrop for fullscreen/mobile -->
	{#if fullscreenMode}
		<ChatDrawerBackdrop onclick={closeChatDrawer} />
	{/if}

	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		id="ai-chat-dialog"
		class="flex flex-col bg-white {fullscreenMode
			? 'fixed top-0 right-0 left-0 h-dvh'
			: 'fixed top-0 right-0 h-full border-l border-surface-200 shadow-xl'}"
		style={fullscreenMode ? '' : `width: ${drawerWidth}px`}
		role="dialog"
		aria-modal="true"
		aria-labelledby="ai-chat-title"
		tabindex="-1"
		onkeydown={handleKeydown}
		ontouchstart={onTouchStart}
		ontouchend={onTouchEnd}
		transition:fly={{ x: fullscreenMode ? 0 : 400, duration: 200 }}
	>
		<!-- Resize handle: side-panel mode only -->
		{#if !fullscreenMode}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div
				class="group justify-left absolute top-0 left-0 z-10 flex h-full w-2 cursor-col-resize items-center"
				role="separator"
				aria-orientation="vertical"
				aria-label="Resize chat panel"
				tabindex="0"
				aria-valuenow={drawerWidth}
				aria-valuemin={MIN_WIDTH}
				aria-valuemax={MAX_WIDTH}
				onpointerdown={onResizeStart}
				onkeydown={handleResizeKeydown}
			>
				<!-- Visible indicator: thin line, brighter on hover -->
				<div class="h-full w-0.5 rounded-full transition-colors group-hover:bg-primary-400"></div>
			</div>
		{/if}

		<!-- Header (with safe-area top inset on mobile) -->
		<div class="pt-[env(safe-area-inset-top)]">
			<ChatHeader
				{threads}
				{activeThreadId}
				{isFullscreen}
				showFullscreenToggle={!isSmallScreen}
				onSelectThread={handleSelectThread}
				onNewChat={handleNewChat}
				onClear={handleRequestClear}
				onToggleFullscreen={handleToggleFullscreen}
				onClose={closeChatDrawer}
			/>
		</div>

		<!-- Context indicator -->
		<ChatContextBar {context} {contextMeta} />

		{#if showPatientBoundaryPrompt}
			<div
				class="flex items-center justify-between gap-3 border-b border-warning-200 bg-warning-50 px-4 py-2 text-sm"
			>
				<span class="min-w-0 text-surface-800">
					Continue this chat with the new patient context, or start a new chat?
				</span>
				<div class="flex shrink-0 items-center gap-2">
					<button
						type="button"
						class="btn preset-filled-primary-500 btn-sm"
						onclick={handleStartPatientThread}
					>
						Start new chat
					</button>
					<button
						type="button"
						class="btn preset-tonal btn-sm"
						onclick={handleContinuePatientThread}
					>
						Continue here
					</button>
				</div>
			</div>
		{/if}

		<!-- Messages -->
		<ChatMessageList {messages} {isStreaming} {isEmpty}>
			{#snippet emptyState()}
				<ChatEmptyState {quickPrompts} onPromptClick={handlePromptClick} />
			{/snippet}
			{#snippet children(args)}
				{@const prevMsg = args.index > 0 ? messages[args.index - 1] : null}
				<ChatMessage
					message={args.message}
					showRoundDivider={args.message.role === 'tool' &&
						prevMsg?.role === 'tool' &&
						(args.message.round ?? 0) !== (prevMsg?.round ?? 0)}
					onCopy={handleCopy}
					onRetry={handleRetry}
				/>
			{/snippet}
		</ChatMessageList>

		<!-- Error banner -->
		{#if chatError}
			<div
				class="flex items-center justify-between gap-3 border-t border-error-200 bg-error-50 px-4 py-2 text-sm text-error-600"
				role="alert"
			>
				<span class="min-w-0">
					{chatError.message}
					{#if chatError.retryAfter}
						<span class="ml-1 whitespace-nowrap">— retry in {chatError.retryAfter}s</span>
					{/if}
				</span>
				<div class="flex shrink-0 items-center gap-1">
					<button type="button" class="btn preset-outlined-error-500 btn-sm" onclick={handleRetry}>
						Retry
					</button>
					<button
						type="button"
						class="btn btn-sm hover:preset-tonal"
						aria-label="Dismiss error"
						onclick={handleDismissError}
					>
						×
					</button>
				</div>
			</div>
		{/if}

		<!-- Input (with safe-area bottom inset on mobile) -->
		<div class="border-t border-surface-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
			<ChatInput
				status={chatStatus}
				placeholder={inputPlaceholder}
				onSend={handleSend}
				onCancel={handleCancel}
			/>
		</div>
	</div>

	<!-- Clear conversation confirmation -->
	<ConfirmDialog
		open={showClearConfirm}
		title="Clear conversation?"
		message="This will delete all messages in the current thread."
		confirmLabel="Clear"
		onconfirm={handleConfirmClear}
		oncancel={handleCancelClear}
	/>
{/if}
