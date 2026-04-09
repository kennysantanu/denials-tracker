import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

export function getSystemPreferences(supabase: SupabaseClient<Database>) {
	return supabase.from('preferences').select('*').order('name');
}

export function getSystemPreference(supabase: SupabaseClient<Database>, name: string) {
	return supabase.from('preferences').select('*').eq('name', name).single();
}

export async function setSystemPreference(
	supabase: SupabaseClient<Database>,
	name: string,
	value: string | null,
	dataType: string = 'string'
) {
	const { data: existing } = await supabase
		.from('preferences')
		.select('id')
		.eq('name', name)
		.single();

	if (existing) {
		return supabase
			.from('preferences')
			.update({ value })
			.eq('id', existing.id)
			.select()
			.single();
	}

	return supabase
		.from('preferences')
		.insert({ name, value, data_type: dataType })
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
