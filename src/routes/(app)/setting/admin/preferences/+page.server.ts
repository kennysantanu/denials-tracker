import type { PageServerLoad, Actions } from './$types';

// Server load function
export const load = (async ({ locals: { supabase, safeGetSession } }) => {

    let { data: dataPreferences, error: errorPreferences } = await supabase
        .from('preferences')
        .select('id, name, data_type, value')

    return { dataPreferences: dataPreferences || []};
}) satisfies PageServerLoad;

// Form actions
export const actions: Actions = {    
     
};
