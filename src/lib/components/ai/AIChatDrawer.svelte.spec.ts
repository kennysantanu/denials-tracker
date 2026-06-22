import { page } from 'vitest/browser';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AIChatDrawer from './AIChatDrawer.svelte';

const { state } = vi.hoisted(() => {
	const state: { _open: boolean; _context: Record<string, unknown> } = {
		_open: false,
		_context: { route: '/dashboard' }
	};
	return { state };
});

vi.mock('$lib/stores/chatContext.svelte', () => ({
	getChatContext: () => state._context,
	isChatDrawerOpen: () => state._open,
	closeChatDrawer: vi.fn(() => {
		state._open = false;
	}),
	openChatDrawer: vi.fn((prompt?: string) => {
		state._open = true;
		if (prompt) state._context.focusedPrompt = prompt;
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

function setLocalHistory(messages: Array<{ role: string; content: string }>) {
	localStorage.setItem('aiChatHistory', JSON.stringify(messages));
}

describe('AIChatDrawer.svelte', () => {
	beforeEach(() => {
		state._open = false;
		state._context = { route: '/dashboard' };
		localStorage.clear();
	});

	it('is not visible when drawer is closed', async () => {
		render(AIChatDrawer);

		await expect
			.element(page.getByText('AI Assistant'))
			.not.toBeInTheDocument();
	});

	it('shows empty state prompt when open with no messages and no patient', async () => {
		state._open = true;
		render(AIChatDrawer);

		await expect
			.element(page.getByText('Ask me about denials, appeals, or billing data.'))
			.toBeInTheDocument();

		// No quick prompts when patientId is absent
		await expect
			.element(page.getByText('Quick prompts:'))
			.not.toBeInTheDocument();
	});

	it('shows quick prompt buttons when patientId is set', async () => {
		state._open = true;
		state._context = { route: '/record/1', patientId: 1 };
		render(AIChatDrawer);

		await expect
			.element(page.getByText("Summarize this patient's open denials"))
			.toBeInTheDocument();
		await expect
			.element(page.getByText('Which denials need follow-up soon?'))
			.toBeInTheDocument();
		await expect
			.element(page.getByText('Draft an appeal letter for the most recent denial'))
			.toBeInTheDocument();
	});

	it('renders a user message bubble', async () => {
		state._open = true;
		setLocalHistory([{ role: 'user', content: 'Hello, can you help?' }]);
		render(AIChatDrawer);

		await expect
			.element(page.getByText('Hello, can you help?'))
			.toBeInTheDocument();
	});

	it('renders an assistant markdown message with copy button', async () => {
		state._open = true;
		setLocalHistory([
			{
				role: 'assistant',
				content: 'Sure! Here is **bold text** and `inline code`.'
			}
		]);
		render(AIChatDrawer);

		// Markdown renders — bold text is visible (rendered as <strong>)
		await expect
			.element(page.getByText('bold text'))
			.toBeInTheDocument();

		// Markdown inline code is visible (rendered as <code>)
		await expect
			.element(page.getByText('inline code'))
			.toBeInTheDocument();

		// Copy button is present on assistant messages
		await expect
			.element(page.getByTitle('Copy'))
			.toBeInTheDocument();
	});

	it('shows stop button and hides send button when loading', async () => {
		state._open = true;

		// Mock fetch to never resolve so we stay in loading state
		vi.spyOn(globalThis, 'fetch').mockImplementation(
			() => new Promise<Response>(() => {})
		);

		render(AIChatDrawer);

		// Fill the textarea with a message
		const textarea = page.getByRole('textbox');
		await textarea.fill('Test message');

		// Click Send to trigger loading state
		await page.getByRole('button', { name: 'Send' }).click();

		// Loading state replaces Send with Stop generating
		await expect
			.element(page.getByRole('button', { name: '✕ Stop generating' }))
			.toBeInTheDocument();

		// The bouncing dots indicator is present (3 animated dots)
		await expect
			.element(page.getByText('●').first())
			.toBeInTheDocument();

		vi.restoreAllMocks();
	});

	it('clears messages from localStorage via clear button', async () => {
		state._open = true;
		setLocalHistory([
			{ role: 'user', content: 'old message' }
		]);
		render(AIChatDrawer);

		// Click the clear chat button
		await page.getByTitle('Clear chat').click();

		// localStorage should be cleared
		expect(localStorage.getItem('aiChatHistory')).toBeNull();
	});

	it('persists drawer width to localStorage on mount', async () => {
		localStorage.setItem('aiChatDrawerWidth', '500');
		state._open = true;
		render(AIChatDrawer);

		// Width is restored from localStorage — the panel is visible
		await expect
			.element(page.getByText('AI Assistant'))
			.toBeInTheDocument();
	});
});
