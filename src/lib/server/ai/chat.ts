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

export interface StreamEvent {
	type: 'delta' | 'reasoning_delta' | 'tool_call_start' | 'tool_call_result' | 'round' | 'done' | 'error';
	content?: string;
	reasoning?: string;
	id?: string;
	name?: string;
	args?: string;
	result?: string;
	round?: number;
	max?: number;
	durationMs?: number;
	tokensUsed?: number;
	model?: string;
	toolCalls?: { name: string; args: Record<string, unknown>; result: string }[];
	message?: string;
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

/**
 * Streaming version of callChat. Returns an async generator that yields
 * StreamEvent objects as the model responds. Tool calls are executed between
 * rounds and emitted as tool_call_start / tool_call_result events.
 */
export async function* callChatStream(
	supabase: SupabaseClient<Database>,
	messages: ChatCompletionMessageParam[],
	tools: ChatCompletionTool[],
	toolContext: ToolContext
): AsyncGenerator<StreamEvent> {
	const ai = await getOpenAIClient(supabase);
	if (!ai) {
		yield { type: 'error', message: 'AI is not configured' };
		return;
	}

	const { client, model } = ai;
	const toolLog: ChatResult['toolCalls'] = [];
	const conversationMessages: ChatCompletionMessageParam[] = [...messages];
	let toolsSupported = true;
	const startTime = Date.now();

	for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
		const useTools = toolsSupported && tools.length > 0;

		yield { type: 'round', round, max: MAX_TOOL_ROUNDS };

		const stream = await client.chat.completions.create({
			model,
			messages: conversationMessages,
			tools: useTools ? tools : undefined,
			stream: true
			// stream_options is OpenAI-proprietary; omitted for LM Studio / Ollama compat
		});

		// Accumulate streaming deltas
		let contentAcc = '';
		const toolCallAcc: Map<
			number,
			{ id: string; name: string; args: string }
		> = new Map();

		let hasChoices = false;

		for await (const chunk of stream) {
			const delta = chunk.choices?.[0]?.delta;
			if (!delta) continue;

			hasChoices = true;

			// Reasoning content delta (DeepSeek extended thinking / o1 reasoning)
			if ((delta as Record<string, unknown>).reasoning_content) {
				yield {
					type: 'reasoning_delta',
					reasoning: (delta as Record<string, unknown>).reasoning_content as string
				};
			}

			// Text content delta
			if (delta.content) {
				contentAcc += delta.content;
				yield { type: 'delta', content: delta.content };
			}

			// Tool call deltas (accumulated by index)
			if (delta.tool_calls) {
				for (const tc of delta.tool_calls) {
					const idx = tc.index;
					if (!toolCallAcc.has(idx)) {
						toolCallAcc.set(idx, { id: tc.id ?? '', name: '', args: '' });
					}
					const acc = toolCallAcc.get(idx)!;
					if (tc.id) acc.id = tc.id;
					if (tc.function?.name) acc.name = tc.function.name;
					if (tc.function?.arguments) acc.args += tc.function.arguments;
				}
			}
		}

		// No choices in first round → tools not supported
		if (!hasChoices && round === 0 && useTools) {
			toolsSupported = false;
			continue;
		}

		// If we got content but no tool calls, we're done
		if (toolCallAcc.size === 0) {
			const durationMs = Date.now() - startTime;
			yield {
				type: 'done',
				content: contentAcc,
				toolCalls: toolLog.length > 0 ? toolLog : undefined,
				durationMs,
				model
			};
			return;
		}

		// Process tool calls
		const toolCalls = [...toolCallAcc.values()];
		const assistantToolCalls = toolCalls.map((tc) => ({
			id: tc.id,
			type: 'function' as const,
			function: { name: tc.name, arguments: tc.args }
		}));

		conversationMessages.push({
			role: 'assistant',
			content: contentAcc || null,
			tool_calls: assistantToolCalls
		});

		for (const tc of toolCalls) {
			yield {
				type: 'tool_call_start',
				id: tc.id,
				name: tc.name,
				args: tc.args
			};

			let args: Record<string, unknown>;
			try {
				args = JSON.parse(tc.args);
			} catch {
				args = {};
			}

			const result = await executeToolCall(toolContext, tc.name, args);

			toolLog.push({ name: tc.name, args, result });

			yield {
				type: 'tool_call_result',
				id: tc.id,
				name: tc.name,
				result
			};

			conversationMessages.push({
				role: 'tool',
				tool_call_id: tc.id,
				content: result
			});
		}
	}

	// Exhausted tool rounds — final non-streaming call
	const finalResponse = await client.chat.completions.create({
		model,
		messages: conversationMessages
	});

	const finalContent = finalResponse.choices?.[0]?.message?.content ?? '';
	if (finalContent) {
		yield { type: 'delta', content: finalContent };
	}

	const durationMs = Date.now() - startTime;
	yield {
		type: 'done',
		content: finalContent,
		toolCalls: toolLog.length > 0 ? toolLog : undefined,
		durationMs,
		model
	};
}
