import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

type InsurancesInsert = Database['public']['Tables']['insurances']['Insert'];
type InsurancesUpdate = Database['public']['Tables']['insurances']['Update'];

export async function getInsurances(supabase: SupabaseClient<Database>) {
	return await supabase.from('insurances').select('*').order('name');
}

export async function createInsurance(
	supabase: SupabaseClient<Database>,
	data: InsurancesInsert
) {
	return await supabase.from('insurances').insert(data).select().single();
}

export async function updateInsurance(
	supabase: SupabaseClient<Database>,
	id: number,
	data: InsurancesUpdate
) {
	return await supabase.from('insurances').update(data).eq('id', id).select().single();
}

export async function deleteInsurance(supabase: SupabaseClient<Database>, id: number) {
	return await supabase.from('insurances').delete().eq('id', id);
}
