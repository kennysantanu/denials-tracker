import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

type NotesRow = Database['public']['Tables']['notes']['Row'];
type NotesInsert = Database['public']['Tables']['notes']['Insert'];

export async function getNotesByDenial(supabase: SupabaseClient<Database>, denialId: number) {
	return supabase
		.from('notes')
		.select('*')
		.eq('denial_id', denialId)
		.order('created_at', { ascending: false });
}

export async function createNote(supabase: SupabaseClient<Database>, data: NotesInsert) {
	return supabase.from('notes').insert(data).select().single();
}

export async function deleteNote(supabase: SupabaseClient<Database>, id: number) {
	return supabase.from('notes').delete().eq('id', id);
}
