export const load = async ({ parent, locals: { supabase, safeGetSession} }) => {   
    await parent();

    return {};
}

export const actions = {
	getReport: async ({ request, locals: { supabase, safeGetSession } }) => {
        const formData = await request.formData();
        const reportType = formData.get('report_type');

        if (reportType == 'denials') {
            const { data: dataReport, error: errorReport } = await supabase
                .from('denials')
                .select(`id, patient_id, service_start_date, service_end_date, billed_amount, paid_amount,
                    patients(id, last_name, first_name, date_of_birth), 
                    notes(id, denial_id, created_at, modified_at, created_by:created_by(username), modified_by:modified_by(username), note), 
                    insurances(name), 
                    labels(id, label_name, bg_color, txt_color)`)  
                .order('created_at', { referencedTable: 'notes', ascending: false })
                .limit(1, { referencedTable: 'notes' })

            return { dataReport: dataReport || []};
        }
        else {
            return { dataReport: []};
        }   
    },
}
