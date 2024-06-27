import { superValidate, fail } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import type { PageServerLoad, Actions } from './$types';

// Form schema
const schemaNewRoleForm = z.object({
    role_name: z.string(),
});

// Server load function
export const load = (async ({ locals: { supabase, safeGetSession } }) => {
    const newRoleForm = await superValidate(zod(schemaNewRoleForm));
    
    let { data: roles, error } = await supabase
    .from('roles')
    .select('*')        

    return { newRoleForm, roles: roles || []};
}) satisfies PageServerLoad;

// Form actions
export const actions: Actions = {
    createRole: async ({ request, locals: { supabase, safeGetSession } }) => {
        const form = await superValidate(request, zod(schemaNewRoleForm));

        if (!form.valid) {
            return fail(400, { form });
        }

        const { data, error } = await supabase
            .from('roles')
            .insert([
            { role_name: form.data.role_name.trim() },
            ])
            .select()
                      
        if (error) {
            return fail(400, { form });
        }

        return form;
    },
};
