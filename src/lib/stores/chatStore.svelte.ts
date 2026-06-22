import { browser } from '$app/environment';
import { toastSuccess, toastError } from '$lib/toast';

export interface ChatThread {
	id: string;
	title: string;
	lastMessageAt: string;
	archivedAt: string | null;
	createdAt: string;
}

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant' | 'tool';
	content: string;
	toolName?: string;
	toolArgs?: unknown;
	toolResult?: string;
	status?: 'pending' | 'streaming' | 'complete' | 'error' | 'cancelled';
	createdAt: string;
}

type StoreStatus = 'idle' | 'sending' | 'streaming' | 'error' | 'cancelled';

interface StoreError {
	message: string;
	retryAfter?: number;
}

// ── State ────────────────────────────────────────────────────────

let threads = $state<ChatThread[]>([]);
let activeThreadId = $state<string | null>(null);
let messages = $state<ChatMessage[]>([]);
let status = $state<StoreStatus>('idle');
let error = $state<StoreError | null>(null);

let abortController = $state<AbortController | null>(null);
let _bc: BroadcastChannel | null = null;

// ── BroadcastChannel (lazy init) ─────────────────────────────────

function getBc(): BroadcastChannel | null {
	if (!browser) return null;
	if (!_bc) {
		try {
			_bc = new BroadcastChannel('ai-chat');
			_bc.onmessage = (ev: MessageEvent) => handleBcEvent(ev.data);
		} catch {
			// BroadcastChannel not supported
		}
	}
	return _bc;
}

function handleBcEvent(data: Record<string, unknown>) {
	switch (data.type) {
		case 'thread-created': {
			const t = data.thread as ChatThread;
			if (!threads.find((x) => x.id === t.id)) {
				threads = [t, ...threads];
			}
			break;
		}
		case 'thread-archived': {
			const tid = data.threadId as string;
			threads = threads.filter((t) => t.id !== tid);
			if (activeThreadId === tid) {
				activeThreadId = null;
				messages = [];
			}
			break;
		}
		case 'message-added': {
			const msg = data.message as ChatMessage;
			const tid = data.threadId as string;
			if (tid === activeThreadId && !messages.find((m) => m.id === msg.id)) {
				messages = [...messages, msg];
			}
			// Update thread list timestamp
			threads = threads.map((t) =>
				t.id === tid ? { ...t, lastMessageAt: msg.createdAt } : t
			);
			break;
		}
		case 'stream-started':
		case 'stream-ended':
		case 'thread-title-updated':
			break;
	}
}

function bcPost(data: Record<string, unknown>) {
	getBc()?.postMessage(data);
}

// ── Persistence helpers ──────────────────────────────────────────

const ACTIVE_THREAD_KEY = 'aiChatActiveThreadId';
const LEGACY_HISTORY_KEY = 'aiChatHistory';

function loadActiveThreadFromStorage(): string | null {
	if (!browser) return null;
	return localStorage.getItem(ACTIVE_THREAD_KEY);
}

function saveActiveThreadToStorage(id: string | null) {
	if (!browser) return;
	if (id) {
		localStorage.setItem(ACTIVE_THREAD_KEY, id);
	} else {
		localStorage.removeItem(ACTIVE_THREAD_KEY);
	}
}

function removeLegacyHistory() {
	if (!browser) return;
	try {
		localStorage.removeItem(LEGACY_HISTORY_KEY);
	} catch {
		// ignore
	}
}

// ── API helpers ──────────────────────────────────────────────────

class ApiError extends Error {
	retryAfter?: number;
	constructor(message: string, retryAfter?: number) {
		super(message);
		this.name = 'ApiError';
		this.retryAfter = retryAfter;
	}
}

async function apiFetch(path: string, init?: RequestInit) {
	const res = await fetch(path, init);
	if (!res.ok) {
		const body = await res.json().catch(() => null);
		const msg = body?.error ?? `Request failed (${res.status})`;
		const retryAfter =
			res.status === 429
				? parseInt(res.headers.get('Retry-After') ?? '0', 10) || undefined
				: undefined;
		throw new ApiError(msg, retryAfter);
	}
	return res.json();
}

// ── Public methods ───────────────────────────────────────────────

export function getThreads(): ChatThread[] {
	return threads;
}

export function getActiveThreadId(): string | null {
	return activeThreadId;
}

export function getMessages(): ChatMessage[] {
	return messages;
}

export function getStatus(): StoreStatus {
	return status;
}

export function getError(): StoreError | null {
	return error;
}

export async function loadThreads() {
	error = null;
	try {
		const data = await apiFetch('/api/v1/ai/threads');
		threads = data.threads as ChatThread[];
	} catch (err) {
		error = { message: err instanceof Error ? err.message : 'Failed to load threads' };
	}
}

export async function loadThread(threadId: string) {
	error = null;
	status = 'idle';
	try {
		const data = await apiFetch(`/api/v1/ai/threads/${threadId}/messages`);
		messages = (data.messages as ChatMessage[]).map((m) => ({
			...m,
			status: 'complete' as const
		}));
		activeThreadId = threadId;
		saveActiveThreadToStorage(threadId);
	} catch (err) {
		error = { message: err instanceof Error ? err.message : 'Failed to load thread' };
	}
}

export function startNewThread() {
	status = 'idle';
	error = null;
	messages = [];
	activeThreadId = crypto.randomUUID();
	saveActiveThreadToStorage(activeThreadId);
	removeLegacyHistory();
}

export async function send(text: string) {
	if (!text.trim() || status === 'sending' || status === 'streaming') return;

	error = null;

	// Ensure we have an active thread
	let threadId = activeThreadId;
	if (!threadId) {
		threadId = crypto.randomUUID();
		activeThreadId = threadId;
		saveActiveThreadToStorage(threadId);
	}

	const userMsgId = crypto.randomUUID();
	const userMsg: ChatMessage = {
		id: userMsgId,
		role: 'user',
		content: text,
		createdAt: new Date().toISOString()
	};

	// Optimistic append
	messages = [...messages, userMsg];
	status = 'sending';

	abortController = new AbortController();

	try {
		// Persist user message
		await apiFetch(`/api/v1/ai/threads/${threadId}/messages`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				clientMessageId: userMsgId,
				role: 'user',
				content: text
			})
		});

		// Check if thread is new → add to switcher, broadcast
		const existingThread = threads.find((t) => t.id === threadId);
		if (!existingThread) {
			const newThread: ChatThread = {
				id: threadId!,
				title: text.slice(0, 40),
				lastMessageAt: userMsg.createdAt,
				archivedAt: null,
				createdAt: userMsg.createdAt
			};
			threads = [newThread, ...threads];
			bcPost({ type: 'thread-created', thread: newThread });
		}

		bcPost({ type: 'message-added', threadId, message: userMsg });

		// Call AI chat
		const apiMessages = messages
			.filter((m) => m.role === 'user' || m.role === 'assistant')
			.map((m) => ({ role: m.role, content: m.content }));

		const chatData = await apiFetch('/api/v1/ai/chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			signal: abortController.signal,
			body: JSON.stringify({
				messages: apiMessages,
				context: {
					patientId: undefined,
					denialId: undefined
				}
			})
		});

		// Append assistant message
		const assistantMsgId = crypto.randomUUID();
		const assistantMsg: ChatMessage = {
			id: assistantMsgId,
			role: 'assistant',
			content: chatData.content as string,
			createdAt: new Date().toISOString(),
			status: 'complete'
		};
		messages = [...messages, assistantMsg];

		// Persist assistant message
		await apiFetch(`/api/v1/ai/threads/${threadId}/messages`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				clientMessageId: assistantMsgId,
				role: 'assistant',
				content: chatData.content
			})
		});

		bcPost({ type: 'message-added', threadId, message: assistantMsg });

		status = 'idle';
	} catch (err) {
		if (err instanceof DOMException && err.name === 'AbortError') {
			status = 'cancelled';
			return;
		}
		if (err instanceof ApiError) {
			error = { message: err.message, retryAfter: err.retryAfter };
		} else {
			error = { message: err instanceof Error ? err.message : 'An error occurred' };
		}
		status = 'error';
	} finally {
		abortController = null;
	}
}

export function cancel() {
	abortController?.abort();
	status = 'idle';
	abortController = null;
}

export async function retryLast() {
	if (status === 'sending' || status === 'streaming') return;

	// Find last user message
	const lastUserIdx = findLastIndex(messages, (m) => m.role === 'user');
	if (lastUserIdx === -1) return;

	// Remove everything from last user message onward
	const lastUserMsg = messages[lastUserIdx];
	messages = messages.slice(0, lastUserIdx);
	error = null;
	status = 'idle';

	// Re-send
	await send(lastUserMsg.content);
}

export async function editAndResubmit(messageId: string, newText: string) {
	if (status === 'sending' || status === 'streaming') return;

	const idx = messages.findIndex((m) => m.id === messageId);
	if (idx === -1) return;

	// Truncate at this message (remove it and everything after)
	messages = messages.slice(0, idx);

	// Send new text
	await send(newText);
}

export async function clearThread() {
	const threadId = activeThreadId;
	if (!threadId) {
		startNewThread();
		return;
	}

	try {
		await apiFetch(`/api/v1/ai/threads/${threadId}/archive`, { method: 'POST' });
	} catch {
		// Best-effort archive
	}

	threads = threads.filter((t) => t.id !== threadId);
	bcPost({ type: 'thread-archived', threadId });

	startNewThread();
}

export async function copyMessage(messageId: string) {
	const msg = messages.find((m) => m.id === messageId);
	if (!msg) return;

	try {
		await navigator.clipboard.writeText(msg.content);
		toastSuccess('Copied');
	} catch {
		toastError('Copy failed');
	}
}

// ── Initialization ────────────────────────────────────────────────

export function initChatStore() {
	if (!browser) return;

	removeLegacyHistory();

	const savedThreadId = loadActiveThreadFromStorage();
	if (savedThreadId) {
		activeThreadId = savedThreadId;
		// Load threads in background; if active thread is in the list, auto-load
		loadThreads().then(() => {
			const found = threads.find((t) => t.id === savedThreadId);
			if (found) {
				loadThread(savedThreadId!);
			} else {
				// Active thread was archived or pruned
				activeThreadId = null;
				messages = [];
				saveActiveThreadToStorage(null);
			}
		});
	} else {
		loadThreads();
	}
}

// ── Helpers ───────────────────────────────────────────────────────

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
	for (let i = arr.length - 1; i >= 0; i--) {
		if (predicate(arr[i])) return i;
	}
	return -1;
}
