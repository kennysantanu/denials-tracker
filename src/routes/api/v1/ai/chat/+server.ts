import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isAIConfigured } from '$lib/server/ai/client';
import { callChatStream, type StreamEvent, type ToolCallLog } from '$lib/server/ai/chat';
import {
	aiToolDefinitions,
	toolPermissions,
	toolInteractionType,
	type ToolContext
} from '$lib/server/ai/tools';
import { logAudit } from '$lib/server/audit';
import { getSystemPreference } from '$lib/server/db/preferences';
import { requirePermission, loadEffectivePermissions } from '$lib/server/authz';
import {
	DEFAULT_SYSTEM_PROMPT,
	buildPageContextSnippet,
	buildSystemPrompt
} from '$lib/server/ai/systemPrompt';
import { prepareLongThreadMessages } from '$lib/server/ai/longThread';
import { estimateChars } from '$lib/ai/messages';
import type {
	ChatCompletionMessageParam,
	ChatCompletionTool
} from 'openai/resources/chat/completions';

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

interface ContextMeta {
	systemPromptChars: number;
	pageContextChars: number;
	historyChars: number;
	toolSchemaChars: number;
	longThreadSummaryChars: number;
	estimatedTokens: number;
	modelContextWindow: number | null;
	pageContextTruncated: boolean;
	longThreadSummaryUsed: boolean;
	sourceMessageCount: number;
	estimatedTokensSaved: number;
}

type ContextMetaEvent = StreamEvent & { type: 'context_meta'; contextMeta: ContextMeta };

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
	const now = Date.now();
	const entry = rateLimitMap.get(userId);

	if (!entry || now >= entry.resetAt) {
		rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
		return { allowed: true };
	}

	if (entry.count >= RATE_LIMIT) {
		const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
		return { allowed: false, retryAfter };
	}

	entry.count++;
	return { allowed: true };
}

if (typeof process !== 'undefined' && process.versions?.node) {
	setInterval(() => {
		const now = Date.now();
		for (const [key, val] of rateLimitMap) {
			if (now >= val.resetAt) rateLimitMap.delete(key);
		}
	}, 5 * 60_000);
}

function inferContextWindow(model: string): number | null {
	const lower = model.toLowerCase();
	if (lower.includes('128k')) return 128_000;
	if (lower.includes('32k')) return 32_000;
	if (lower.includes('16k')) return 16_000;
	if (lower.includes('8k')) return 8_000;
	return null;
}

async function logStreamingInteraction(input: {
	locals: App.Locals;
	userId: string;
	request: Request;
	messages: ChatCompletionMessageParam[];
	contextData: { patientId?: number; pageData?: Record<string, unknown> };
	finalContent: string;
	finalToolCalls: ToolCallLog[] | undefined;
	finalDurationMs: number;
	finalModel: string;
	contextMeta: ContextMeta;
}) {
	const {
		locals,
		userId,
		request,
		messages,
		contextData,
		finalContent,
		finalToolCalls,
		finalDurationMs,
		finalModel,
		contextMeta
	} = input;

	logAudit(
		locals.supabase,
		userId,
		'ai_chat',
		'ai_interaction',
		null,
		{
			messageCount: messages.length,
			toolCalls: finalToolCalls?.map((t) => t.name) ?? [],
			context: contextData,
			contextMeta
		},
		request
	);

	const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
	try {
		await locals.supabase.from('ai_interactions').insert({
			user_id: userId,
			denial_id: null,
			interaction_type: finalToolCalls?.length
				? (toolInteractionType[finalToolCalls[0].name] ?? 'chat')
				: 'chat',
			tool_name: finalToolCalls?.[0]?.name ?? null,
			prompt_summary:
				typeof lastUserMessage?.content === 'string'
					? lastUserMessage.content.slice(0, 500)
					: null,
			response_summary: finalContent.slice(0, 500) || null,
			model_used: finalModel || null,
			tokens_used: contextMeta.estimatedTokens,
			duration_ms: finalDurationMs
		});
	} catch (err) {
		console.error('[ai/chat] Failed to log ai_interactions:', err);
	}
}

export const POST: RequestHandler = async (event) => {
	const { request, locals, url } = event;
	const user = await locals.getUser();
	if (!user) error(401, 'Unauthorized');

	await requirePermission(event, 'ai.chat', { resourceType: 'ai_interaction' });

	const configured = await isAIConfigured(locals.supabase);
	if (!configured) {
		error(
			503,
			'AI is not configured. An administrator must set the AI Base URL and Model Name in Settings > Admin > Preferences.'
		);
	}

	const rateCheck = checkRateLimit(user.id);
	if (!rateCheck.allowed) {
		return json(
			{ error: 'Rate limit exceeded. Please try again later.' },
			{
				status: 429,
				headers: { 'Retry-After': String(rateCheck.retryAfter ?? 60) }
			}
		);
	}

	const wantsStream =
		url.searchParams.get('stream') === 'true' ||
		request.headers.get('Accept') === 'text/event-stream';
	if (!wantsStream) {
		return json(
			{
				error:
					'Streaming is required. Use ?stream=true and accept server-sent events from this endpoint.'
			},
			{ status: 501 }
		);
	}

	const body = await request.json();
	const messages: ChatCompletionMessageParam[] = body.messages;
	const contextData: { patientId?: number; pageData?: Record<string, unknown> } =
		body.context ?? {};

	if (!Array.isArray(messages) || messages.length === 0) {
		error(400, 'Messages array is required');
	}

	const effective = await loadEffectivePermissions(event);
	const allowedTools: ChatCompletionTool[] = aiToolDefinitions.filter((tool) => {
		const fn = tool as { type: 'function'; function: { name: string } };
		if (fn.type !== 'function') return true;
		const requiredPerm = toolPermissions[fn.function.name];
		if (!requiredPerm) return true;
		return effective[requiredPerm] === true;
	});

	const toolContext: ToolContext = {
		supabase: locals.supabase,
		userId: user.id,
		patientId: contextData.patientId
	};

	const promptResult = await getSystemPreference(locals.supabase, 'ai_chat_system_prompt');
	const basePrompt = promptResult.data?.value?.trim() || DEFAULT_SYSTEM_PROMPT;
	const modelName = typeof body.modelName === 'string' ? body.modelName : 'configured';
	const modelContextWindow = inferContextWindow(modelName);
	const pageContext = buildPageContextSnippet(contextData.pageData);

	const initialPrompt = buildSystemPrompt({
		base: basePrompt,
		runtime: { model: modelName, role: 'user', timezone: 'America/Los_Angeles' },
		pageContext: pageContext.text
	});
	const longThread = prepareLongThreadMessages(messages, modelContextWindow, initialPrompt.length);
	const systemPrompt = buildSystemPrompt({
		base: basePrompt,
		runtime: { model: modelName, role: 'user', timezone: 'America/Los_Angeles' },
		pageContext: pageContext.text,
		longThreadSummary: longThread.summary
	});

	const systemMessages: ChatCompletionMessageParam[] = [{ role: 'system', content: systemPrompt }];
	const fullMessages: ChatCompletionMessageParam[] = [...systemMessages, ...longThread.messages];
	const toolSchemaChars = JSON.stringify(allowedTools).length;
	const historyChars = estimateChars(longThread.messages);
	const contextMeta: ContextMeta = {
		systemPromptChars: systemPrompt.length,
		pageContextChars: pageContext.chars,
		historyChars,
		toolSchemaChars,
		longThreadSummaryChars: longThread.summaryChars,
		estimatedTokens: Math.ceil((systemPrompt.length + historyChars + toolSchemaChars) / 4),
		modelContextWindow,
		pageContextTruncated: pageContext.truncated,
		longThreadSummaryUsed: longThread.used,
		sourceMessageCount: longThread.sourceMessageCount,
		estimatedTokensSaved: longThread.estimatedTokensSaved
	};

	const stream = callChatStream(locals.supabase, fullMessages, allowedTools, toolContext);

	const responseBody = new ReadableStream({
		async start(controller) {
			let finalContent = '';
			let finalToolCalls: ToolCallLog[] | undefined;
			let finalDurationMs = 0;
			let finalModel = '';
			const encoder = new TextEncoder();

			function sse(event: StreamEvent | ContextMetaEvent) {
				const data = JSON.stringify(event);
				controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${data}\n\n`));
			}

			try {
				sse({ type: 'context_meta', contextMeta } as ContextMetaEvent);

				for await (const event of stream) {
					sse(event);
					if (event.type === 'done') {
						finalContent = event.content ?? '';
						finalToolCalls = event.toolCalls;
						finalDurationMs = event.durationMs ?? 0;
						finalModel = event.model ?? '';
					}
				}

				await logStreamingInteraction({
					locals,
					userId: user.id,
					request,
					messages,
					contextData,
					finalContent,
					finalToolCalls,
					finalDurationMs,
					finalModel,
					contextMeta
				});

				controller.close();
			} catch (err) {
				const message = err instanceof Error ? err.message : 'AI stream failed';
				console.error('[ai/chat] Stream error:', message);
				const errorEvent: StreamEvent = { type: 'error', message };
				controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`));
				controller.close();
			}
		}
	});

	return new Response(responseBody, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
