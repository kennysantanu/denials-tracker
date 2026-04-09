import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

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
): Promise<{ client: OpenAI; model: string } | null> {
	const [baseUrlResult, modelResult] = await Promise.all([
		supabase.from('preferences').select('value').eq('name', 'ai_base_url').single(),
		supabase.from('preferences').select('value').eq('name', 'ai_model_name').single()
	]);

	const baseURL = baseUrlResult.data?.value;
	const model = modelResult.data?.value;

	if (!baseURL || !model) return null;

	const client = new OpenAI({
		baseURL,
		apiKey: 'not-needed'
	});

	return { client, model };
}
