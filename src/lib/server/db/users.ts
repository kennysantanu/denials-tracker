import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

type Users = Database['public']['Tables']['users'];

export function getUsers(supabase: SupabaseClient<Database>) {
	return supabase.from('users').select('*, roles!public_users_role_fkey(*)').order('created_at');
}

export function getUserById(supabase: SupabaseClient<Database>, id: string) {
	return supabase.from('users').select('*, roles!public_users_role_fkey(*)').eq('id', id).single();
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
