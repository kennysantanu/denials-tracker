<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getChatContext,
		isChatDrawerOpen,
		closeChatDrawer
	} from '$lib/stores/chatContext.svelte';
	import DOMPurify from 'dompurify';
	import { marked } from 'marked';

	interface ChatMessage {
		role: 'user' | 'assistant';
		content: string;
	}

	interface DenialChip {
		id: number;
		serviceStartDate: string;
	}

	let messages = $state<ChatMessage[]>([]);
	let input = $state('');
	let isLoading = $state(false);
	let abortController = $state<AbortController | null>(null);
	let messagesContainer: HTMLDivElement | undefined = $state();
	let drawerWidth = $state(400);
	let isSmallScreen = $state(false);
	let isFullscreen = $state(false);
	let hydrated = $state(false);

	/** Full-screen mode: always on small screens, or when user toggled it on desktop */
	const fullscreenMode = $derived(isSmallScreen || isFullscreen);

	const open = $derived(isChatDrawerOpen());
	const context = $derived(getChatContext());

	// Restore width, fullscreen preference, and chat history from localStorage
	onMount(() => {
		const savedWidth = localStorage.getItem('aiChatDrawerWidth');
		if (savedWidth) drawerWidth = Math.max(320, Math.min(800, parseInt(savedWidth, 10)));

		isFullscreen = localStorage.getItem('aiChatFullscreen') === 'true';

		const savedHistory = localStorage.getItem('aiChatHistory');
		if (savedHistory) {
			try {
				messages = JSON.parse(savedHistory);
			} catch {
				// ignore corrupt storage
			}
		}
		hydrated = true;

		const mq = window.matchMedia('(max-width: 640px)');
		isSmallScreen = mq.matches;
		const handler = (e: MediaQueryListEvent) => (isSmallScreen = e.matches);
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	});

	// Persist chat history after hydration (prevents overwriting before load)
	$effect(() => {
		if (!hydrated) return;
		if (messages.length > 0) {
			localStorage.setItem('aiChatHistory', JSON.stringify(messages));
		} else {
			localStorage.removeItem('aiChatHistory');
		}
	});

	let lastFocusedPrompt = $state('');

	// Auto-fill focused prompt from context
	$effect(() => {
		if (open && context.focusedPrompt && context.focusedPrompt !== lastFocusedPrompt) {
			lastFocusedPrompt = context.focusedPrompt;
			queueMicrotask(() => {
				input = context.focusedPrompt ?? '';
				sendMessage();
			});
		}
	});

	// Auto-scroll on new messages
	$effect(() => {
		if (messages.length && messagesContainer) {
			requestAnimationFrame(() => {
				messagesContainer?.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
			});
		}
	});

	async function sendMessage() {
		const text = input.trim();
		if (!text || isLoading) return;

		const userMessage: ChatMessage = { role: 'user', content: text };
		messages = [...messages, userMessage];
		input = '';
		isLoading = true;
		abortController = new AbortController();

		try {
			const apiMessages = messages.map((m) => ({ role: m.role, content: m.content }));

			const res = await fetch('/api/v1/ai/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				signal: abortController.signal,
				body: JSON.stringify({
					messages: apiMessages,
					context: {
						patientId: context.patientId,
						denialId: context.denialId
					}
				})
			});

			if (!res.ok) {
				const errData = await res.json().catch(() => null);
				throw new Error(errData?.error ?? `Request failed (${res.status})`);
			}

			const data = await res.json();
			messages = [...messages, { role: 'assistant', content: data.content }];
		} catch (err: unknown) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			const msg = err instanceof Error ? err.message : 'An error occurred';
			messages = [...messages, { role: 'assistant', content: `⚠️ ${msg}` }];
		} finally {
			isLoading = false;
			abortController = null;
		}
	}

	function cancelGeneration() {
		abortController?.abort();
		isLoading = false;
		abortController = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	function clearChat() {
		messages = [];
		input = '';
		localStorage.removeItem('aiChatHistory');
	}

	function toggleFullscreen() {
		isFullscreen = !isFullscreen;
		localStorage.setItem('aiChatFullscreen', String(isFullscreen));
	}

	function renderMarkdown(content: string): string {
		const raw = marked.parse(content);
		if (typeof raw === 'string') {
			return DOMPurify.sanitize(raw);
		}
		return '';
	}

	async function copyToClipboard(text: string) {
		await navigator.clipboard.writeText(text);
	}

	function formatDOS(dateStr: string): string {
		if (!dateStr) return 'unknown';
		const [y, m, d] = dateStr.split('-');
		return `${m}/${d}/${y.slice(2)}`;
	}

	function buildPatientContextSnippet(): string {
		const pd = context.pageData as Record<string, unknown> | undefined;
		const name = (pd?.patientName as string) ?? 'this patient';
		const dob = pd?.patientDob as string | undefined;
		const open = (pd?.openDenialCount as number) ?? 0;
		const closed = (pd?.closedDenialCount as number) ?? 0;
		const dobStr = dob ? ` (DOB: ${dob})` : '';
		return `Context: I'm viewing patient ${name}${dobStr} — ${open} open denial${open !== 1 ? 's' : ''}, ${closed} closed.`;
	}

	function buildDenialContextSnippet(denial: DenialChip): string {
		return `Context: I'm focused on denial DOS ${formatDOS(denial.serviceStartDate)} (ID: #${denial.id}).`;
	}

	function prefillContext(text: string) {
		input = text;
	}

	const quickPrompts = $derived(
		context.patientId
			? [
					"Summarize this patient's open denials",
					'Which denials need follow-up soon?',
					'Draft an appeal letter for the most recent denial'
				]
			: []
	);

	// Resize handle — only active in side-panel mode
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
	<div
		class="z-50 flex flex-col bg-white {fullscreenMode
			? 'fixed inset-0'
			: 'fixed top-0 right-0 h-full border-l border-surface-200 shadow-xl'}"
		style={fullscreenMode ? '' : `width: ${drawerWidth}px`}
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
		<div class="flex h-14 shrink-0 items-center justify-between border-b border-surface-200 px-4">
			<h2 class="text-sm font-semibold text-surface-800">AI Assistant</h2>
			<div class="flex items-center gap-1">
				<button
					type="button"
					onclick={clearChat}
					class="rounded p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
					title="Clear chat"
				>
					🗑️
				</button>
				<!-- Fullscreen toggle: hidden on small screens (auto-fullscreen) -->
				{#if !isSmallScreen}
					<button
						type="button"
						onclick={toggleFullscreen}
						class="rounded p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
						title={isFullscreen ? 'Exit full screen' : 'Full screen'}
					>
						{isFullscreen ? '⤡' : '⤢'}
					</button>
				{/if}
				<button
					type="button"
					onclick={closeChatDrawer}
					class="rounded p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
					title="Close"
				>
					✕
				</button>
			</div>
		</div>

		<!-- Messages -->
		<div bind:this={messagesContainer} class="flex-1 space-y-4 overflow-y-auto p-4">
			{#if messages.length === 0}
				<div class="flex h-full flex-col items-center justify-center gap-4 px-2">
					<p class="text-center text-sm text-surface-400">
						Ask me about denials, appeals, or billing data.
					</p>
					{#if quickPrompts.length > 0}
						<div class="w-full space-y-2">
							<p class="text-center text-xs text-surface-400">Quick prompts:</p>
							{#each quickPrompts as prompt}
								<button
									type="button"
									onclick={() => prefillContext(prompt)}
									class="w-full rounded-base border border-surface-200 px-3 py-2 text-left text-xs text-surface-600 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
								>
									{prompt}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{:else}
				{#each messages as msg, i (i)}
					<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
						<div
							class="max-w-[85%] rounded-lg px-3 py-2 text-sm {msg.role === 'user'
								? 'bg-primary-100 text-primary-900'
								: 'bg-surface-100 text-surface-800'}"
						>
							{#if msg.role === 'assistant'}
								<div class="prose prose-sm max-w-none">
									{@html renderMarkdown(msg.content)}
								</div>
								<button
									type="button"
									onclick={() => copyToClipboard(msg.content)}
									class="mt-1 text-xs text-surface-400 hover:text-surface-600"
									title="Copy"
								>
									📋 Copy
								</button>
							{:else}
								{msg.content}
							{/if}
						</div>
					</div>
				{/each}
			{/if}
			{#if isLoading}
				<div class="flex justify-start">
					<div class="rounded-lg bg-surface-100 px-3 py-2 text-sm text-surface-500">
						<span class="inline-flex gap-1">
							<span class="animate-bounce">●</span>
							<span class="animate-bounce" style="animation-delay: 0.1s">●</span>
							<span class="animate-bounce" style="animation-delay: 0.2s">●</span>
						</span>
					</div>
				</div>
			{/if}
		</div>

		<!-- Context chips -->
		{#if context.patientId}
			{@const pd = context.pageData as Record<string, unknown> | undefined}
			{@const pageDenials = (pd?.denials as DenialChip[]) ?? []}
			<div
				class="flex flex-wrap items-center gap-1.5 border-t border-surface-100 bg-surface-50 px-3 py-1.5"
			>
				<span class="text-xs text-surface-400">Add context:</span>
				<button
					type="button"
					onclick={() => prefillContext(buildPatientContextSnippet())}
					class="rounded-full border border-surface-200 bg-white px-2.5 py-0.5 text-xs font-medium text-surface-600 transition-colors hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700"
					title="Prefill with patient context"
				>
					📋 {pd?.patientName ?? 'Patient'}
				</button>
				{#each pageDenials as denial (denial.id)}
					<button
						type="button"
						onclick={() => prefillContext(buildDenialContextSnippet(denial))}
						class="rounded-full border border-surface-200 bg-white px-2.5 py-0.5 text-xs font-medium text-surface-600 transition-colors hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700"
						title="Prefill with denial context"
					>
						🗒️ DOS {formatDOS(denial.serviceStartDate)}
					</button>
				{/each}
			</div>
		{/if}

		<!-- Input -->
		<div class="border-t border-surface-200 p-3">
			{#if isLoading}
				<button
					type="button"
					onclick={cancelGeneration}
					class="w-full rounded-lg bg-error-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-error-700"
				>
					✕ Stop generating
				</button>
			{:else}
				<div class="flex gap-2">
					<textarea
						bind:value={input}
						onkeydown={handleKeydown}
						placeholder="Type a message..."
						rows={4}
						class="flex-1 resize-none rounded-lg border border-surface-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
					></textarea>
					<button
						type="button"
						onclick={sendMessage}
						disabled={!input.trim()}
						class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
					>
						Send
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
