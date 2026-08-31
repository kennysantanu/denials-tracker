import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';
import { toChatReasoningEffort, type ChatReasoningEffort } from './reasoning';

/**
 * Check if AI is configured by reading system preferences for base URL and model name.
 */
export async function isAIConfigured(supabase: SupabaseClient<Database>): Promise<boolean> {
	const [baseUrlResult, modelResult] = await Promise.all([
		supabase.from('preferences').select('value').eq('name', 'ai_base_url').single(),
		supabase.from('preferences').select('value').eq('name', 'ai_model_name').single()
	]);

	return !!(baseUrlResult.data?.value && modelResult.data?.value);
}

/**
 * Create an OpenAI-compatible client configured from system preferences.
 * Uses an empty API key since this targets local AI (e.g. LM Studio).
 */
export async function getOpenAIClient(
	supabase: SupabaseClient<Database>
): Promise<{ client: OpenAI; model: string; reasoningEffort?: ChatReasoningEffort } | null> {
	const [baseUrlResult, modelResult, reasoningEffortResult] = await Promise.all([
		supabase.from('preferences').select('value').eq('name', 'ai_base_url').single(),
		supabase.from('preferences').select('value').eq('name', 'ai_model_name').single(),
		supabase.from('preferences').select('value').eq('name', 'ai_reasoning_effort').single()
	]);

	const rawBaseURL = baseUrlResult.data?.value;
	const model = modelResult.data?.value;
	const reasoningEffort = toChatReasoningEffort(reasoningEffortResult.data?.value);

	if (!rawBaseURL || !model) return null;

	// Strip trailing slashes; the admin must enter the full base URL
	// including any path prefix (e.g. http://host:1234/v1)
	const baseURL = rawBaseURL.replace(/\/+$/, '');

	const client = new OpenAI({
		baseURL,
		apiKey: 'not-needed'
	});

	return { client, model, reasoningEffort };
}
