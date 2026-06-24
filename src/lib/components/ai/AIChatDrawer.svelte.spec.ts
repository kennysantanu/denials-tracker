import { page } from 'vitest/browser';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AIChatDrawer from './AIChatDrawer.svelte';
import { generateUUID } from '$lib/utils';

const { state } = vi.hoisted(() => {
	const state = {
		_open: false,
		_context: { route: '/dashboard' } as Record<string, unknown>,
		_chatMessages: [] as Array<{ id: string; role: string; content: string; status?: string; createdAt: string }>,
		_chatThreads: [] as Array<{ id: string; title: string; lastMessageAt: string; archivedAt: null; createdAt: string }>,
		_chatActiveThreadId: null as string | null,
		_chatStatus: 'idle' as string,
		_chatError: null as { message: string } | null
	};
	return { state };
});

vi.mock('$lib/stores/chatContext.svelte', () => ({
	getChatContext: () => state._context,
	isChatDrawerOpen: () => state._open,
	closeChatDrawer: vi.fn(() => {
		state._open = false;
	}),
	openChatDrawer: vi.fn(() => {
		state._open = true;
	}),
	toggleChatDrawer: vi.fn(() => {
		state._open = !state._open;
	}),
	setChatContext: vi.fn((c: Record<string, unknown>) => {
		state._context = c;
	}),
	updateChatContext: vi.fn((p: Record<string, unknown>) => {
		state._context = { ...state._context, ...p };
	})
}));

vi.mock('$lib/stores/chatStore.svelte', () => ({
	initChatStore: vi.fn(),
	getMessages: () => state._chatMessages,
	getThreads: () => state._chatThreads,
	getActiveThreadId: () => state._chatActiveThreadId,
	getStatus: () => state._chatStatus,
	getError: () => state._chatError,
	loadThreads: vi.fn(),
	loadThread: vi.fn(),
	startNewThread: vi.fn(),
	send: vi.fn(),
	cancel: vi.fn(),
	retryLast: vi.fn(),
	editAndResubmit: vi.fn(),
	clearThread: vi.fn(),
	copyMessage: vi.fn()
}));

function makeMsg(role: string, content: string, status?: string) {
	return {
		id: generateUUID(),
		role,
		content,
		status: status ?? 'complete',
		createdAt: new Date().toISOString()
	};
}

describe('AIChatDrawer.svelte', () => {
	beforeEach(() => {
		state._open = false;
		state._context = { route: '/dashboard' };
		state._chatMessages = [];
		state._chatThreads = [];
		state._chatActiveThreadId = null;
		state._chatStatus = 'idle';
		state._chatError = null;
	});

	it('is not visible when drawer is closed', async () => {
		render(AIChatDrawer);
		await expect.element(page.getByText('AI Assistant')).not.toBeInTheDocument();
	});

	it('shows empty state when open with no messages', async () => {
		state._open = true;
		render(AIChatDrawer);
		await expect
			.element(page.getByText('Ask me about denials, appeals, or billing data.'))
			.toBeInTheDocument();
	});

	it('shows quick prompts when patientId is set', async () => {
		state._open = true;
		state._context = { route: '/record/1', patientId: 1 };
		render(AIChatDrawer);
		await expect
			.element(page.getByText("Summarize this patient's open denials"))
			.toBeInTheDocument();
	});

	it('context bar shows patient name when patient pageData is loaded', async () => {
		state._open = true;
		state._context = {
			route: '/record/1',
			patientId: 1,
			pageData: { patient: { first_name: 'Ada', last_name: 'Lovelace' } }
		};
		render(AIChatDrawer);
		await expect.element(page.getByText('Patient', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('Lovelace, Ada')).toBeInTheDocument();
	});

	it('context bar shows report record count on report page', async () => {
		state._open = true;
		state._context = { route: '/report', pageData: { recordCount: 42 } };
		render(AIChatDrawer);
		await expect.element(page.getByText('Report')).toBeInTheDocument();
		await expect.element(page.getByText('42 records')).toBeInTheDocument();
	});

	it('context bar shows general context when no pageData', async () => {
		state._open = true;
		state._context = { route: '/dashboard' };
		render(AIChatDrawer);
		await expect.element(page.getByText('General context — /dashboard')).toBeInTheDocument();
	});

	it('renders messages when present', async () => {
		state._open = true;
		state._chatMessages = [
			makeMsg('user', 'Hello'),
			makeMsg('assistant', 'Hi there! How can I help?')
		];
		render(AIChatDrawer);
		await expect.element(page.getByText('Hello')).toBeInTheDocument();
		await expect.element(page.getByText('Hi there! How can I help?')).toBeInTheDocument();
	});

	it('shows header action buttons', async () => {
		state._open = true;
		render(AIChatDrawer);
		await expect
			.element(page.getByRole('button', { name: 'Clear chat' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Close' }))
			.toBeInTheDocument();
	});

	it('shows stop button when streaming', async () => {
		state._open = true;
		state._chatStatus = 'streaming';
		state._chatMessages = [makeMsg('user', 'test')];
		render(AIChatDrawer);
		await expect.element(page.getByText('Stop generating')).toBeInTheDocument();
	});

	it('shows error banner when error present', async () => {
		state._open = true;
		state._chatError = { message: 'Something went wrong' };
		render(AIChatDrawer);
		await expect.element(page.getByText('Something went wrong')).toBeInTheDocument();
	});
});
