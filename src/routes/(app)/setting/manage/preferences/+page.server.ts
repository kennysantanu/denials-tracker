import type { PageServerLoad, Actions } from './$types';

// Server load function
export const load = (async ({ locals: { supabase, safeGetSession } }) => {

    const { data: dataSystemPreferences, error: errorSystemPreferences } = await supabase
        .from('preferences')
        .select('id, name, data_type, value')

    const { data: dataUserPreferences, error: errorUserPreferences } = await supabase
        .from('preference_user')
        .select('user_id, preference_id, user_value')

    return { dataSystemPreferences: dataSystemPreferences || [], dataUserPreferences: dataUserPreferences || [] };
}) satisfies PageServerLoad;

// Form actions
export const actions: Actions = {    
     
};
