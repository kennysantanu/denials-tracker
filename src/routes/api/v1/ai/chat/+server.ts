import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isAIConfigured } from '$lib/server/ai/client';
import { callChat } from '$lib/server/ai/chat';
import { aiToolDefinitions, toolPermissions, type ToolContext } from '$lib/server/ai/tools';
import { logAudit } from '$lib/server/audit';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

// In-memory rate limiting: userId -> { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

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

// Clean up stale entries periodically
setInterval(() => {
	const now = Date.now();
	for (const [key, val] of rateLimitMap) {
		if (now >= val.resetAt) rateLimitMap.delete(key);
	}
}, 5 * 60_000);

const SYSTEM_PROMPT = `You are a helpful medical billing assistant for a denials tracking application. You help users understand denial claims, generate appeal letters, and analyze billing data. Be concise and professional. When generating appeal letters, use a formal business letter format. Always base your responses on the actual data provided through tool calls.`;

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = await locals.getUser();
	if (!user) error(401, 'Unauthorized');

	// Check if AI is configured
	const configured = await isAIConfigured(locals.supabase);
	if (!configured) {
		error(503, 'AI is not configured. An administrator must set the AI Base URL and Model Name in Settings > Admin > Preferences.');
	}

	// Rate limiting
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

	const body = await request.json();
	const messages: ChatCompletionMessageParam[] = body.messages;
	const contextData: { patientId?: number; denialId?: number } = body.context ?? {};

	if (!Array.isArray(messages) || messages.length === 0) {
		error(400, 'Messages array is required');
	}

	// Load user permissions
	const { data: userData } = await locals.supabase
		.from('users')
		.select('*, roles(*)')
		.eq('id', user.id)
		.single();

	const permissions =
		(userData?.roles as { permissions?: Record<string, boolean> } | null)?.permissions ?? {};

	// Filter tools based on user permissions
	const allowedTools: ChatCompletionTool[] = aiToolDefinitions.filter((tool) => {
		const fn = tool as { type: 'function'; function: { name: string } };
		if (fn.type !== 'function') return true;
		const requiredPerm = toolPermissions[fn.function.name];
		if (!requiredPerm) return true;
		return permissions[requiredPerm] === true;
	});

	const toolContext: ToolContext = {
		supabase: locals.supabase,
		userId: user.id,
		patientId: contextData.patientId,
		denialId: contextData.denialId
	};

	// Prepend system message
	const fullMessages: ChatCompletionMessageParam[] = [
		{ role: 'system', content: SYSTEM_PROMPT },
		...messages
	];

	try {
		const startTime = Date.now();
		const result = await callChat(locals.supabase, fullMessages, allowedTools, toolContext);
		const durationMs = Date.now() - startTime;

		// Log to audit_log
		logAudit(locals.supabase, user.id, 'ai_chat', 'ai_interaction', null, {
			messageCount: messages.length,
			toolCalls: result.toolCalls?.map((t) => t.name) ?? [],
			context: contextData
		}, request);

		// Log to ai_interactions table
		const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
		locals.supabase.from('ai_interactions').insert({
			user_id: user.id,
			denial_id: contextData.denialId ?? null,
			interaction_type: result.toolCalls?.length ? result.toolCalls[0].name.includes('summary') ? 'summary_tool' : result.toolCalls[0].name.includes('appeal') ? 'appeal_tool' : result.toolCalls[0].name.includes('query') ? 'query_tool' : 'chat' : 'chat',
			tool_name: result.toolCalls?.[0]?.name ?? null,
			prompt_summary: typeof lastUserMessage?.content === 'string' ? lastUserMessage.content.slice(0, 500) : null,
			response_summary: result.content.slice(0, 500) || null,
			model_used: null,
			tokens_used: null,
			duration_ms: durationMs
		}).then(() => {});

		return json({
			content: result.content,
			toolCalls: result.toolCalls
		});
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'AI request failed';
		console.error('[ai/chat] Error:', message);
		return json({ error: message }, { status: 500 });
	}
};
