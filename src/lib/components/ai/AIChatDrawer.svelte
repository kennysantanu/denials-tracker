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

	let messages = $state<ChatMessage[]>([]);
	let input = $state('');
	let isLoading = $state(false);
	let messagesContainer: HTMLDivElement | undefined = $state();
	let drawerWidth = $state(400);
	let isResizing = $state(false);
	let isMobile = $state(false);

	const open = $derived(isChatDrawerOpen());
	const context = $derived(getChatContext());

	// Restore width from localStorage
	onMount(() => {
		const savedWidth = localStorage.getItem('aiChatDrawerWidth');
		if (savedWidth) drawerWidth = Math.max(320, Math.min(800, parseInt(savedWidth, 10)));

		const mq = window.matchMedia('(max-width: 768px)');
		isMobile = mq.matches;
		const handler = (e: MediaQueryListEvent) => (isMobile = e.matches);
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	});

	let lastFocusedPrompt = $state('');

	// Auto-fill focused prompt from context
	$effect(() => {
		if (open && context.focusedPrompt && context.focusedPrompt !== lastFocusedPrompt) {
			lastFocusedPrompt = context.focusedPrompt;
			// Use microtask to avoid assignment in $effect
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

		try {
			// Build messages payload for API (only role + content)
			const apiMessages = messages.map((m) => ({ role: m.role, content: m.content }));

			const res = await fetch('/api/v1/ai/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
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
			const msg = err instanceof Error ? err.message : 'An error occurred';
			messages = [...messages, { role: 'assistant', content: `⚠️ ${msg}` }];
		} finally {
			isLoading = false;
		}
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

	// Resize handling
	function onResizeStart(e: PointerEvent) {
		if (isMobile) return;
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
	<!-- Mobile: full-screen overlay. Desktop: side panel -->
	{#if isMobile}
		<div class="fixed inset-0 z-50 flex flex-col bg-white">
			<!-- Header -->
			<div class="flex h-14 items-center justify-between border-b border-surface-200 px-4">
				<h2 class="text-sm font-semibold text-surface-800">AI Assistant</h2>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={clearChat}
						class="rounded p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
						title="Clear chat"
					>
						🗑️
					</button>
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
			<div bind:this={messagesContainer} class="flex-1 overflow-y-auto p-4 space-y-4">
				{#if messages.length === 0}
					<div class="flex h-full items-center justify-center">
						<p class="text-sm text-surface-400">Ask me about denials, appeals, or billing data.</p>
					</div>
				{:else}
					{#each messages as msg, i (i)}
						<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
							<div class="max-w-[85%] rounded-lg px-3 py-2 text-sm {msg.role === 'user' ? 'bg-primary-100 text-primary-900' : 'bg-surface-100 text-surface-800'}">
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

			<!-- Input -->
			<div class="border-t border-surface-200 p-3">
				<div class="flex gap-2">
					<textarea
						bind:value={input}
						onkeydown={handleKeydown}
						placeholder="Type a message..."
						rows={1}
						class="flex-1 resize-none rounded-lg border border-surface-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
					></textarea>
					<button
						type="button"
						onclick={sendMessage}
						disabled={isLoading || !input.trim()}
						class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
					>
						Send
					</button>
				</div>
			</div>
		</div>
	{:else}
		<!-- Desktop side panel -->
		<div
			class="fixed right-0 top-0 z-40 flex h-full flex-col border-l border-surface-200 bg-white shadow-xl"
			style="width: {drawerWidth}px"
		>
			<!-- Resize handle -->
			<button
				type="button"
				class="absolute left-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-primary-200 transition-colors"
				onpointerdown={onResizeStart}
				aria-label="Resize chat panel"
			></button>

			<!-- Header -->
			<div class="flex h-14 items-center justify-between border-b border-surface-200 px-4 pl-4">
				<h2 class="text-sm font-semibold text-surface-800">AI Assistant</h2>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={clearChat}
						class="rounded p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
						title="Clear chat"
					>
						🗑️
					</button>
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
			<div bind:this={messagesContainer} class="flex-1 overflow-y-auto p-4 space-y-4">
				{#if messages.length === 0}
					<div class="flex h-full items-center justify-center">
						<p class="text-sm text-surface-400">Ask me about denials, appeals, or billing data.</p>
					</div>
				{:else}
					{#each messages as msg, i (i)}
						<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
							<div class="max-w-[85%] rounded-lg px-3 py-2 text-sm {msg.role === 'user' ? 'bg-primary-100 text-primary-900' : 'bg-surface-100 text-surface-800'}">
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

			<!-- Input -->
			<div class="border-t border-surface-200 p-3">
				<div class="flex gap-2">
					<textarea
						bind:value={input}
						onkeydown={handleKeydown}
						placeholder="Type a message..."
						rows={1}
						class="flex-1 resize-none rounded-lg border border-surface-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
					></textarea>
					<button
						type="button"
						onclick={sendMessage}
						disabled={isLoading || !input.trim()}
						class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
					>
						Send
					</button>
				</div>
			</div>
		</div>
	{/if}
{/if}
