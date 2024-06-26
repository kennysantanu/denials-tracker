import { json } from '@sveltejs/kit';

export const GET = async ({ url, locals: { supabase, safeGetSession } }) => {

    let patientid = url.searchParams.get('patientid');
    
    if (patientid) {
        let { data: denials, error } = await supabase
        .from('denials')
        .select('*')        
        .eq('patient_id', patientid)
        .order('service_start_date', { ascending: false });

        if (error) {
            return json({ error: 'Error fetching denials' }, { status: 500 });
        }
        
        return json(denials);
    }
    else {        
        return json({ error: 'No patient id provided' }, { status: 400 });
    }
}
