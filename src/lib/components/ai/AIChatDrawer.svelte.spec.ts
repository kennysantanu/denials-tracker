import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AIChatDrawer from './AIChatDrawer.svelte';

// Mock SvelteKit stores - aiEnabled=false scenario
vi.mock('$lib/stores/chatContext.svelte', () => {
	let _open = false;
	return {
		getChatContext: () => ({ route: '/dashboard' }),
		isChatDrawerOpen: () => _open,
		closeChatDrawer: vi.fn(() => {
			_open = false;
		}),
		openChatDrawer: vi.fn((prompt?: string) => {
			_open = true;
		}),
		toggleChatDrawer: vi.fn(() => {
			_open = !_open;
		}),
		setChatContext: vi.fn(),
		updateChatContext: vi.fn()
	};
});

describe('AIChatDrawer.svelte', () => {
	it('is not visible when drawer is closed', async () => {
		render(AIChatDrawer);

		// The drawer should not render when isChatDrawerOpen() returns false
		await expect.element(page.getByText('AI Assistant')).not.toBeInTheDocument();
	});
});
