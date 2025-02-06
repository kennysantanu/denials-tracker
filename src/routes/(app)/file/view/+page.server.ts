import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({url, locals: { supabase, safeGetSession }}) => {

    const name = url.searchParams.get('name');
    
    let { data: fileData, error: fileError } = await supabase
        .from('files')
        .select('*')
        .eq('name', name)
        .single();
    
    if (fileError) {
        return { fileData: [] };
    }

    let { data:claimData, error:claimError } = await supabase
        .from('files')
        .select(`
            *, 
            notes(id, denial_id, created_at, modified_at, created_by:created_by(username), modified_by:modified_by(username), note, 
                denials(patient_id, service_start_date, service_end_date,
                    patients(id, last_name, first_name, date_of_birth),
                    labels(label_name, bg_color, txt_color)
                )
            )
        `)
        .eq('name', name);

    if (claimError) {
        return { claimData: [] };
    }

    return { fileData, claimData };
};

export const actions = {
	updateFileInfo: async ({ request, locals: { supabase, safeGetSession } }) => {

        const form = await request.formData();
        const name = form.get('name');
        const status = form.get('status');
        const note = form.get('note');

        let { data, error } = await supabase
            .from('files')
            .update({ metadata: { status, note }})
            .eq('name', name);

        if (error) {
            return { error };
        }

        {
            redirect(303, `/file/view?name=${name}`);
        }

    }
};
