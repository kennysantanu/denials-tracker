import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

type PatientsRow = Database['public']['Tables']['patients']['Row'];
type PatientsInsert = Database['public']['Tables']['patients']['Insert'];
type PatientsUpdate = Database['public']['Tables']['patients']['Update'];

export async function getPatients(
	supabase: SupabaseClient<Database>,
	includeInactive: boolean = false
): Promise<{ data: PatientsRow[] | null; error: PostgrestError | null }> {
	let query = supabase.from('patients').select('*');
	if (!includeInactive) {
		query = query.eq('is_active', true);
	}
	return query.order('last_name').order('first_name');
}

export async function getPatientById(
	supabase: SupabaseClient<Database>,
	id: number
): Promise<{ data: PatientsRow | null; error: PostgrestError | null }> {
	return supabase.from('patients').select('*').eq('id', id).single();
}

export async function createPatient(
	supabase: SupabaseClient<Database>,
	data: PatientsInsert
): Promise<{ data: PatientsRow | null; error: PostgrestError | null }> {
	return supabase.from('patients').insert(data).select().single();
}

export async function updatePatient(
	supabase: SupabaseClient<Database>,
	id: number,
	data: PatientsUpdate
): Promise<{ data: PatientsRow | null; error: PostgrestError | null }> {
	return supabase.from('patients').update(data).eq('id', id).select().single();
}

export async function deletePatient(
	supabase: SupabaseClient<Database>,
	id: number
): Promise<{ data: null; error: PostgrestError | null }> {
	return supabase.from('patients').delete().eq('id', id);
}
