/**
 * Shared reactive chat context store (Svelte 5 runes).
 * Provides page-level context to the AI chat drawer.
 */

export interface ChatContext {
	/** Current route path */
	route: string;
	/** Patient ID when on a patient page */
	patientId?: number;
	/** Specific denial ID to focus on */
	denialId?: number;
	/** Pre-filled prompt (e.g. "Summarize this denial") */
	focusedPrompt?: string;
	/** Serializable page data for AI context */
	pageData?: Record<string, unknown>;
}

let context = $state<ChatContext>({ route: '' });
let drawerOpen = $state(false);

export function getChatContext(): ChatContext {
	return context;
}

export function setChatContext(newContext: ChatContext): void {
	context = newContext;
}

export function updateChatContext(partial: Partial<ChatContext>): void {
	context = { ...context, ...partial };
}

export function isChatDrawerOpen(): boolean {
	return drawerOpen;
}

export function openChatDrawer(focusedPrompt?: string): void {
	if (focusedPrompt) {
		context = { ...context, focusedPrompt };
	}
	drawerOpen = true;
}

export function closeChatDrawer(): void {
	drawerOpen = false;
}

export function toggleChatDrawer(): void {
	drawerOpen = !drawerOpen;
}
