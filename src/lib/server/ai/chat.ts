import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';
import type {
	ChatCompletionMessageParam,
	ChatCompletionTool
} from 'openai/resources/chat/completions';
import { getOpenAIClient } from './client';
import { executeToolCall, type ToolContext } from './tools';

const MAX_TOOL_ROUNDS = 5;

export interface ToolCallLog {
	id: string;
	name: string;
	args: Record<string, unknown>;
	argsText: string;
	result: string;
}

export interface StreamEvent {
	type:
		| 'delta'
		| 'reasoning_delta'
		| 'tool_call_start'
		| 'tool_call_result'
		| 'round'
		| 'context_meta'
		| 'done'
		| 'error';
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
	toolCalls?: ToolCallLog[];
	contextMeta?: unknown;
	message?: string;
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
	const toolLog: ToolCallLog[] = [];
	const conversationMessages: ChatCompletionMessageParam[] = [...messages];
	let toolsSupported = true;
	const startTime = Date.now();

	for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
		const useTools = toolsSupported && tools.length > 0;

		const stream = await client.chat.completions.create({
			model,
			messages: conversationMessages,
			tools: useTools ? tools : undefined,
			stream: true,
			reasoning_effort: 'low'
			// stream_options is OpenAI-proprietary; omitted for LM Studio / Ollama compat
		});

		yield { type: 'round', round, max: MAX_TOOL_ROUNDS };

		// Accumulate streaming deltas
		let contentAcc = '';
		const toolCallAcc: Map<number, { id: string; name: string; args: string }> = new Map();

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

			toolLog.push({ id: tc.id, name: tc.name, args, argsText: tc.args, result });

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

	// Exhausted tool rounds — make one final streaming call without more tools.
	const finalStream = await client.chat.completions.create({
		model,
		messages: conversationMessages,
		stream: true,
		reasoning_effort: 'low'
	});

	let finalContent = '';
	for await (const chunk of finalStream) {
		const delta = chunk.choices?.[0]?.delta;
		if (!delta) continue;
		if ((delta as Record<string, unknown>).reasoning_content) {
			yield {
				type: 'reasoning_delta',
				reasoning: (delta as Record<string, unknown>).reasoning_content as string
			};
		}
		if (delta.content) {
			finalContent += delta.content;
			yield { type: 'delta', content: delta.content };
		}
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
