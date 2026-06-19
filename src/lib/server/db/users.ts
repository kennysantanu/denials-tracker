import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

type Users = Database['public']['Tables']['users'];

export function getUsers(supabase: SupabaseClient<Database>) {
	return supabase
		.from('users')
		.select('*, user_role_assignments(role_id, revoked_at, roles(id, role_name))')
		.order('created_at');
}

export function getUserById(supabase: SupabaseClient<Database>, id: string) {
	return supabase
		.from('users')
		.select('*, user_role_assignments(role_id, revoked_at, roles(id, role_name))')
		.eq('id', id)
		.single();
}

export function createUser(supabase: SupabaseClient<Database>, data: Users['Insert']) {
	return supabase.from('users').insert(data).select().single();
}

export function updateUser(supabase: SupabaseClient<Database>, id: string, data: Users['Update']) {
	return supabase.from('users').update(data).eq('id', id).select().single();
}

export function deleteUser(supabase: SupabaseClient<Database>, id: string) {
	return supabase.from('users').delete().eq('id', id);
}
