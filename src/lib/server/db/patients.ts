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

export interface PatientListParams {
	page?: number;
	pageSize?: number;
	search?: string;
	sortBy?: 'last_name' | 'first_name' | 'date_of_birth' | 'created_at';
	sortDir?: 'asc' | 'desc';
	includeInactive?: boolean;
}

export interface PatientListResult {
	patients: PatientsRow[];
	total: number;
}

/** Converts MM/DD/YYYY user input to an ISO YYYY-MM-DD date string for exact matching. */
function toIsoDate(input: string): string | null {
	const m = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (m) {
		const [, mo, d, y] = m;
		return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
	}
	// Also accept YYYY-MM-DD directly
	if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
	return null;
}

export async function getPatientsPaginated(
	supabase: SupabaseClient<Database>,
	params: PatientListParams = {}
): Promise<{ data: PatientListResult | null; error: PostgrestError | null }> {
	const {
		page = 1,
		pageSize = 25,
		search,
		sortBy = 'last_name',
		sortDir = 'asc',
		includeInactive = false
	} = params;

	const from = (page - 1) * pageSize;
	const to = from + pageSize - 1;

	let query = supabase.from('patients').select('*', { count: 'exact' });

	if (!includeInactive) {
		query = query.eq('is_active', true);
	}

	if (search && search.trim()) {
		const q = search.trim();
		const isoDate = toIsoDate(q);
		const parts = [`last_name.ilike.%${q}%`, `first_name.ilike.%${q}%`];
		if (isoDate) {
			parts.push(`date_of_birth.eq.${isoDate}`);
		}
		query = query.or(parts.join(','));
	}

	const secondarySort = sortBy === 'last_name' ? 'first_name' : 'last_name';
	query = query
		.order(sortBy, { ascending: sortDir === 'asc' })
		.order(secondarySort, { ascending: true })
		.range(from, to);

	const { data, error, count } = await query;

	if (error) {
		return { data: null, error };
	}

	return {
		data: { patients: data ?? [], total: count ?? 0 },
		error: null
	};
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
