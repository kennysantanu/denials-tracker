import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

/**
 * Names of system preferences that are managed by dedicated UIs
 * (admin AI config, session timeout, etc.) and must NOT appear in:
 *   - the admin generic "Other preferences" list
 *   - the per-user overrides page
 */
export const MANAGED_PREFERENCE_NAMES: ReadonlySet<string> = new Set([
	'ai_base_url',
	'ai_model_name',
	'ai_enabled',
	'idle_timeout_minutes',
	'ai_chat_system_prompt',
	'ai_rewrite_system_prompt'
]);

export function getSystemPreferences(supabase: SupabaseClient<Database>) {
	return supabase.from('preferences').select('*').order('name');
}

export function getSystemPreference(supabase: SupabaseClient<Database>, name: string) {
	return supabase.from('preferences').select('*').eq('name', name).single();
}

/**
 * Atomically insert-or-update a system preference by unique `name`.
 * Uses ON CONFLICT (name) so concurrent callers cannot race between
 * a SELECT-then-INSERT.
 */
export function setSystemPreference(
	supabase: SupabaseClient<Database>,
	name: string,
	value: string | null,
	dataType: string = 'string'
) {
	return supabase
		.from('preferences')
		.upsert({ name, value, data_type: dataType }, { onConflict: 'name' })
		.select()
		.single();
}

export function getUserPreferences(supabase: SupabaseClient<Database>, userId: string) {
	return supabase
		.from('preference_users')
		.select('*, preferences(name, data_type)')
		.eq('user_id', userId);
}

export function setUserPreference(
	supabase: SupabaseClient<Database>,
	preferenceId: number,
	userId: string,
	value: string | null
) {
	return supabase
		.from('preference_users')
		.upsert(
			{ preference_id: preferenceId, user_id: userId, user_value: value },
			{ onConflict: 'preference_id,user_id' }
		)
		.select()
		.single();
}
