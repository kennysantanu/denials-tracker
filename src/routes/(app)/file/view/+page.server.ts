import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({url, locals: { supabase, safeGetSession }}) => {

    const name = url.searchParams.get('name');
    
    let { data: fileData, error } = await supabase
        .from('files')
        .select('*')
        .eq('name', name)
        .single();
    
    if (error) {
        return { fileData: [] };
    }

    return { fileData };
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
