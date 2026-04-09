import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

type Labels = Database['public']['Tables']['labels'];

export function getLabels(supabase: SupabaseClient<Database>) {
	return supabase.from('labels').select('*').order('order', { ascending: true }).order('label_name');
}

export function createLabel(supabase: SupabaseClient<Database>, data: Labels['Insert']) {
	return supabase.from('labels').insert(data).select().single();
}

export function updateLabel(
	supabase: SupabaseClient<Database>,
	id: number,
	data: Labels['Update']
) {
	return supabase.from('labels').update(data).eq('id', id).select().single();
}

export function deleteLabel(supabase: SupabaseClient<Database>, id: number) {
	return supabase.from('labels').delete().eq('id', id);
}
