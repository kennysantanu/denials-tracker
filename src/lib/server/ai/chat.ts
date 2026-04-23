import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';
import type {
	ChatCompletionMessageParam,
	ChatCompletionTool
} from 'openai/resources/chat/completions';
import { getOpenAIClient } from './client';
import { executeToolCall, type ToolContext } from './tools';

const MAX_TOOL_ROUNDS = 5;
const NO_RESPONSE_ERROR =
	'No response from AI model — check that your AI Base URL and Model Name are correct in Settings → Admin → Preferences';

export interface ChatResult {
	content: string;
	toolCalls?: { name: string; args: Record<string, unknown>; result: string }[];
}

/**
 * Orchestrate a chat completion with optional tool calling.
 * Handles the tool-call loop automatically (up to MAX_TOOL_ROUNDS).
 */
export async function callChat(
	supabase: SupabaseClient<Database>,
	messages: ChatCompletionMessageParam[],
	tools: ChatCompletionTool[],
	toolContext: ToolContext
): Promise<ChatResult> {
	const ai = await getOpenAIClient(supabase);
	if (!ai) throw new Error('AI is not configured');

	const { client, model } = ai;
	const toolLog: ChatResult['toolCalls'] = [];

	// Working copy of messages for the conversation loop
	const conversationMessages: ChatCompletionMessageParam[] = [...messages];

	// Detect tool-calling support on first round: retry without tools if model returns empty choices
	let toolsSupported = true;

	for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
		const useTools = toolsSupported && tools.length > 0;
		const response = await client.chat.completions.create({
			model,
			messages: conversationMessages,
			tools: useTools ? tools : undefined
		});

		// Some OpenAI-compatible servers (Ollama, LM Studio, etc.) return empty choices
		// when the model doesn't support tool calling. Fall back to no-tools on first round.
		if (!response.choices?.length && round === 0 && useTools) {
			toolsSupported = false;
			continue;
		}

		const choice = response.choices?.[0];
		if (!choice) throw new Error(NO_RESPONSE_ERROR);

		const message = choice.message;

		// If no tool calls, return the final content
		if (!message.tool_calls?.length) {
			return {
				content: message.content ?? '',
				toolCalls: toolLog.length > 0 ? toolLog : undefined
			};
		}

		// Append assistant message with tool calls
		conversationMessages.push(message);

		// Process each tool call
		for (const toolCall of message.tool_calls) {
			if (toolCall.type !== 'function') continue;
			const fnCall = toolCall as {
				id: string;
				type: 'function';
				function: { name: string; arguments: string };
			};
			const args = JSON.parse(fnCall.function.arguments);
			const result = await executeToolCall(toolContext, fnCall.function.name, args);

			toolLog.push({
				name: fnCall.function.name,
				args,
				result
			});

			conversationMessages.push({
				role: 'tool',
				tool_call_id: fnCall.id,
				content: result
			});
		}
	}

	// Exhausted tool rounds — make one final call without tools
	const finalResponse = await client.chat.completions.create({
		model,
		messages: conversationMessages
	});

	const finalChoice = finalResponse.choices?.[0];
	if (!finalChoice) throw new Error(NO_RESPONSE_ERROR);

	return {
		content: finalChoice.message?.content ?? '',
		toolCalls: toolLog.length > 0 ? toolLog : undefined
	};
}
