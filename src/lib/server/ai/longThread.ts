import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { estimateChars } from '$lib/ai/messages';

export interface LongThreadResult {
	messages: ChatCompletionMessageParam[];
	summary: string | null;
	used: boolean;
	sourceMessageCount: number;
	summaryChars: number;
	estimatedTokensSaved: number;
}

const MESSAGE_COUNT_THRESHOLD = 30;
const CONTEXT_WINDOW_FALLBACK = 8_192;
const RECENT_TAIL_MESSAGES = 16;

export function prepareLongThreadMessages(
	messages: ChatCompletionMessageParam[],
	modelContextWindow: number | null,
	promptChars: number,
	options: { forceSummary?: boolean } = {}
): LongThreadResult {
	const contextWindow = modelContextWindow ?? CONTEXT_WINDOW_FALLBACK;
	const estimatedPromptTokens = Math.ceil((promptChars + estimateChars(messages)) / 4);
	const exceedsCount = messages.length > MESSAGE_COUNT_THRESHOLD;
	const exceedsWindow = estimatedPromptTokens > contextWindow * 0.6;

	if (!options.forceSummary && !exceedsCount && !exceedsWindow) {
		return {
			messages,
			summary: null,
			used: false,
			sourceMessageCount: messages.length,
			summaryChars: 0,
			estimatedTokensSaved: 0
		};
	}

	const splitIndex = findSafeSplitIndex(
		messages,
		Math.max(0, messages.length - RECENT_TAIL_MESSAGES)
	);
	const older = messages.slice(0, splitIndex);
	const recent = messages.slice(splitIndex);
	const summary = summarizeOlderMessages(older);
	const olderChars = estimateChars(older);
	const summaryChars = summary.length;

	return {
		messages: recent,
		summary,
		used: true,
		sourceMessageCount: messages.length,
		summaryChars,
		estimatedTokensSaved: Math.max(0, Math.ceil((olderChars - summaryChars) / 4))
	};
}

function findSafeSplitIndex(messages: ChatCompletionMessageParam[], preferred: number): number {
	let split = preferred;
	while (split < messages.length && messages[split]?.role === 'tool') {
		split++;
	}

	const previous = messages[split - 1];
	if (previous?.role === 'assistant' && 'tool_calls' in previous && previous.tool_calls?.length) {
		while (split < messages.length && messages[split]?.role === 'tool') {
			split++;
		}
	}

	return split;
}

function summarizeOlderMessages(messages: ChatCompletionMessageParam[]): string {
	const facts = new Set<string>();
	const snippets: string[] = [];

	for (const message of messages) {
		const content =
			typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
		if (!content) continue;
		for (const fact of extractIdentifiers(content)) facts.add(fact);
		const compact = content.replace(/\s+/g, ' ').slice(0, 240);
		snippets.push(`${message.role}: ${compact}`);
	}

	const lines = [
		'Older conversation summary. Preserve these identifiers and facts when relevant.',
		...Array.from(facts)
			.slice(0, 80)
			.map((fact) => `- ${fact}`),
		...snippets.slice(-12).map((snippet) => `- ${snippet}`)
	];

	return lines.join('\n').slice(0, 4_000);
}

function extractIdentifiers(content: string): string[] {
	const patterns = [
		/\bpatient(?:\s+id)?[:#\s]+([0-9]+)\b/gi,
		/\bdenial(?:\s+id)?[:#\s]+([0-9]+)\b/gi,
		/\b(?:CARC|RARC)\s*[:#]?\s*([A-Z0-9-]+)\b/gi,
		/\b\d{4}-\d{2}-\d{2}\b/g,
		/\$[0-9][0-9,]*(?:\.[0-9]{2})?\b/g
	];

	const results: string[] = [];
	for (const pattern of patterns) {
		for (const match of content.matchAll(pattern)) {
			results.push(match[0]);
		}
	}
	return results;
}
