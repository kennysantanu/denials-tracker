import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

type Roles = Database['public']['Tables']['roles'];

export function getRoles(supabase: SupabaseClient<Database>) {
	return supabase.from('roles').select('*').order('role_name');
}

export function createRole(supabase: SupabaseClient<Database>, data: Roles['Insert']) {
	return supabase.from('roles').insert(data).select().single();
}

export function updateRole(
	supabase: SupabaseClient<Database>,
	id: number,
	data: Roles['Update']
) {
	return supabase.from('roles').update(data).eq('id', id).select().single();
}

export function deleteRole(supabase: SupabaseClient<Database>, id: number) {
	return supabase.from('roles').delete().eq('id', id);
}
