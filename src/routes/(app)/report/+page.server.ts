export const load = async ({ parent, locals: { supabase, safeGetSession} }) => {   
    await parent();

    return {};
}

export const actions = {
	getReport: async ({ request, locals: { supabase, safeGetSession } }) => {
        const form = await request.formData();
        const reportType = form.get('report_type');
        const include_closed_claims = form.get('include_closed_claims') === 'on' ? true : false;

        if (reportType == 'denials') {
            let query = supabase
                .from('denials')
                .select(`id, patient_id, service_start_date, service_end_date, billed_amount, paid_amount, is_closed,
                    patients(id, last_name, first_name, date_of_birth), 
                    notes(id, denial_id, created_at, modified_at, created_by:created_by(username), modified_by:modified_by(username), note), 
                    insurances(name), 
                    labels(id, label_name, bg_color, txt_color)`)
                
            if (include_closed_claims == false) {
                query = query.is('is_closed', false)
            }

            query = query.order('created_at', { referencedTable: 'notes', ascending: false })
                .limit(1, { referencedTable: 'notes' })

            const { data: dataReport, error: errorReport } = await query;

            return { dataReport: dataReport || []};
        }
        else {
            return { dataReport: []};
        }   
    },
}
