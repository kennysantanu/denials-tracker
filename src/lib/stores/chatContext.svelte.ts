/**
 * Shared reactive chat context store (Svelte 5 runes).
 * Provides page-level context to the AI chat drawer.
 */

import { untrack } from 'svelte';

export interface ChatContext {
	/** Current route path */
	route: string;
	/** Patient ID when on a patient page */
	patientId?: number;
	/** Serializable page data for AI context */
	pageData?: Record<string, unknown>;
}

let context = $state<ChatContext>({ route: '' });
let drawerOpen = $state(false);

export function getChatContext(): ChatContext {
	return context;
}

export function setChatContext(newContext: ChatContext): void {
	// untrack so callers inside $effect don't accidentally depend on `context`
	untrack(() => {
		context = newContext;
	});
}

export function updateChatContext(partial: Partial<ChatContext>): void {
	// untrack the spread read so effect callers don't loop on read+write of `context`
	untrack(() => {
		context = { ...context, ...partial };
	});
}

export function isChatDrawerOpen(): boolean {
	return drawerOpen;
}

export function openChatDrawer(): void {
	drawerOpen = true;
}

export function closeChatDrawer(): void {
	drawerOpen = false;
}

export function toggleChatDrawer(): void {
	drawerOpen = !drawerOpen;
}
