import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isAIConfigured, getOpenAIClient } from '$lib/server/ai/client';
import { logAudit } from '$lib/server/audit';
import { getSystemPreference } from '$lib/server/db/preferences';

// In-memory rate limiting (shared pattern with /api/v1/ai/chat)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
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

// Clean up stale entries periodically.
// Guarded for Node only — Cloudflare Workers reject `setInterval` at module init.
// On CF the Map is per-isolate (ephemeral) so unbounded growth isn't a concern.
if (typeof process !== 'undefined' && process.versions?.node) {
	setInterval(() => {
		const now = Date.now();
		for (const [key, val] of rateLimitMap) {
			if (now >= val.resetAt) rateLimitMap.delete(key);
		}
	}, 5 * 60_000);
}

const DEFAULT_REWRITE_PROMPT =
	'You are a professional medical billing assistant. Rewrite the following note to be clear, concise, and professional. Use proper medical billing terminology where appropriate. Return only the rewritten note text, with no explanations, prefixes, or surrounding quotes.';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = await locals.getUser();
	if (!user) error(401, 'Unauthorized');

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
			{ status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter ?? 60) } }
		);
	}

	const body = await request.json();
	const text: string = body.text;

	if (!text || typeof text !== 'string' || text.trim().length === 0) {
		error(400, 'text is required');
	}

	if (text.length > 5000) {
		error(400, 'Note text is too long (max 5000 characters)');
	}

	const ai = await getOpenAIClient(locals.supabase);
	if (!ai) error(503, 'AI client unavailable');

	const { client, model } = ai;

	const promptResult = await getSystemPreference(locals.supabase, 'ai_rewrite_system_prompt');
	const systemPrompt = promptResult.data?.value?.trim() || DEFAULT_REWRITE_PROMPT;

	const response = await client.chat.completions.create({
		model,
		messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: text.trim() }
		]
	});

	const rewritten = response.choices?.[0]?.message?.content?.trim();
	if (!rewritten) {
		error(502, 'AI returned an empty response. Check your AI Base URL and Model Name in Settings.');
	}

	logAudit(locals.supabase, user.id, 'ai_rewrite', 'ai_interaction', null, { chars: text.length });

	return json({ rewritten });
};
