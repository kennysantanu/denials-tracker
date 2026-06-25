import type {
	ChatCompletionMessageParam,
	ChatCompletionMessageToolCall
} from 'openai/resources/chat/completions';

export interface AiChatMessage {
	id: string;
	role: 'user' | 'assistant' | 'tool';
	content: string;
	toolCallId?: string;
	toolCalls?: Array<{ id: string; name: string; args: string }>;
	createdAt: string;
}

function toAssistantToolCall(
	toolCall: { id: string; name: string; args: string }
): ChatCompletionMessageToolCall | null {
	if (!toolCall.id || !toolCall.name) return null;
	return {
		id: toolCall.id,
		type: 'function',
		function: {
			name: toolCall.name,
			arguments: toolCall.args || '{}'
		}
	};
}

export function buildApiMessages(messages: AiChatMessage[]): ChatCompletionMessageParam[] {
	const byToolCallId = new Map<string, AiChatMessage>();
	for (const message of messages) {
		if (message.role === 'tool' && message.toolCallId && !byToolCallId.has(message.toolCallId)) {
			byToolCallId.set(message.toolCallId, message);
		}
	}

	const apiMessages: ChatCompletionMessageParam[] = [];
	const emittedToolIds = new Set<string>();

	for (const message of messages) {
		if (message.role === 'user') {
			apiMessages.push({ role: 'user', content: message.content });
			continue;
		}

		if (message.role === 'assistant') {
			const pairedToolCalls = (message.toolCalls ?? [])
				.filter((toolCall) => byToolCallId.has(toolCall.id))
				.map(toAssistantToolCall)
				.filter((toolCall): toolCall is ChatCompletionMessageToolCall => toolCall !== null);

			if (pairedToolCalls.length > 0) {
				apiMessages.push({
					role: 'assistant',
					content: message.content || null,
					tool_calls: pairedToolCalls
				});

				for (const toolCall of pairedToolCalls) {
					const toolMessage = byToolCallId.get(toolCall.id);
					if (!toolMessage) continue;
					apiMessages.push({
						role: 'tool',
						tool_call_id: toolCall.id,
						content: toolMessage.content
					});
					emittedToolIds.add(toolCall.id);
				}
			} else if (message.content.trim()) {
				apiMessages.push({ role: 'assistant', content: message.content });
			}
		}
	}

	return apiMessages.filter((message) => {
		if (message.role !== 'tool') return true;
		if (emittedToolIds.has(message.tool_call_id)) return true;
		return false;
	});
}

export function estimateChars(messages: ChatCompletionMessageParam[]): number {
	return messages.reduce((total, message) => {
		if (typeof message.content === 'string') return total + message.content.length;
		if (Array.isArray(message.content)) return total + JSON.stringify(message.content).length;
		return total;
	}, 0);
}
