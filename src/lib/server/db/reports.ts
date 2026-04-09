import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

interface ReportParams {
	startDate?: string;
	endDate?: string;
	includeClosed?: boolean;
}

export async function getReportData(
	supabase: SupabaseClient<Database>,
	params: ReportParams
) {
	let query = supabase
		.from('denials')
		.select(
			`
			*,
			patients ( id, first_name, last_name ),
			denials_insurances ( insurance_id, insurances ( id, name ) )
		`
		)
		.order('service_start_date', { ascending: false });

	if (params.startDate) {
		query = query.gte('service_start_date', params.startDate);
	}

	if (params.endDate) {
		query = query.lte('service_start_date', params.endDate);
	}

	if (!params.includeClosed) {
		query = query.eq('is_closed', false);
	}

	return await query;
}
