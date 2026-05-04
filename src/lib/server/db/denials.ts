import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

type DenialsRow = Database['public']['Tables']['denials']['Row'];
type DenialsInsert = Database['public']['Tables']['denials']['Insert'];
type DenialsUpdate = Database['public']['Tables']['denials']['Update'];

export async function getDenialsByPatient(
	supabase: SupabaseClient<Database>,
	patientId: number
): Promise<{ data: DenialsRow[] | null; error: PostgrestError | null }> {
	return supabase
		.from('denials')
		.select('*')
		.eq('patient_id', patientId)
		.order('service_start_date', { ascending: false });
}

export async function createDenial(
	supabase: SupabaseClient<Database>,
	data: DenialsInsert,
	insuranceIds?: number[],
	labelIds?: number[]
): Promise<{ data: DenialsRow | null; error: PostgrestError | null }> {
	const { data: denial, error } = await supabase.from('denials').insert(data).select().single();

	if (error || !denial) {
		return { data: null, error };
	}

	if (insuranceIds?.length) {
		const { error: insError } = await supabase.from('denials_insurances').insert(
			insuranceIds.map((insurance_id) => ({
				denial_id: denial.id,
				insurance_id
			}))
		);
		if (insError) {
			return { data: denial, error: insError };
		}
	}

	if (labelIds?.length) {
		const { error: lblError } = await supabase.from('denials_labels').insert(
			labelIds.map((label_id) => ({
				denial_id: denial.id,
				label_id
			}))
		);
		if (lblError) {
			return { data: denial, error: lblError };
		}
	}

	return { data: denial, error: null };
}

export async function updateDenial(
	supabase: SupabaseClient<Database>,
	id: number,
	data: DenialsUpdate,
	insuranceIds?: number[],
	labelIds?: number[]
): Promise<{ data: DenialsRow | null; error: PostgrestError | null }> {
	const { data: denial, error } = await supabase
		.from('denials')
		.update(data)
		.eq('id', id)
		.select()
		.single();

	if (error || !denial) {
		return { data: null, error };
	}

	if (insuranceIds !== undefined) {
		const { error: delInsError } = await supabase
			.from('denials_insurances')
			.delete()
			.eq('denial_id', id);
		if (delInsError) {
			return { data: denial, error: delInsError };
		}

		if (insuranceIds.length) {
			const { error: insError } = await supabase.from('denials_insurances').insert(
				insuranceIds.map((insurance_id) => ({
					denial_id: id,
					insurance_id
				}))
			);
			if (insError) {
				return { data: denial, error: insError };
			}
		}
	}

	if (labelIds !== undefined) {
		const { error: delLblError } = await supabase
			.from('denials_labels')
			.delete()
			.eq('denial_id', id);
		if (delLblError) {
			return { data: denial, error: delLblError };
		}

		if (labelIds.length) {
			const { error: lblError } = await supabase.from('denials_labels').insert(
				labelIds.map((label_id) => ({
					denial_id: id,
					label_id
				}))
			);
			if (lblError) {
				return { data: denial, error: lblError };
			}
		}
	}

	return { data: denial, error: null };
}

export async function deleteDenial(
	supabase: SupabaseClient<Database>,
	id: number
): Promise<{ data: null; error: PostgrestError | null }> {
	const { error: insError } = await supabase
		.from('denials_insurances')
		.delete()
		.eq('denial_id', id);
	if (insError) {
		return { data: null, error: insError };
	}

	const { error: lblError } = await supabase.from('denials_labels').delete().eq('denial_id', id);
	if (lblError) {
		return { data: null, error: lblError };
	}

	return supabase.from('denials').delete().eq('id', id);
}
