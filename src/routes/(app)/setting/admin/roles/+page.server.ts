import { superValidate, fail } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import type { PageServerLoad, Actions } from './$types';

// Form schema
const rolesSchema = z.object({
    id: z.number(),
    role_name: z.string(),
});

// Server load function
export const load = (async ({ locals: { supabase, safeGetSession } }) => {
    const newRoleForm = await superValidate(zod(rolesSchema));
    const editRoleForm = await superValidate(zod(rolesSchema));
    
    let { data: roles } = await supabase
    .from('roles')
    .select('*') 
    .order('id', { ascending: true })       

    return { newRoleForm, editRoleForm, roles: roles || []};
}) satisfies PageServerLoad;

// Form actions
export const actions: Actions = {
    createRole: async ({ request, locals: { supabase, safeGetSession } }) => {
        const newRoleForm = await superValidate(request, zod(rolesSchema));

        if (!newRoleForm.valid) {
            return fail(400, { newRoleForm });
        }

        const { data, error } = await supabase
            .from('roles')
            .insert([
            { role_name: newRoleForm.data.role_name.trim() },
            ]);

        if (error) {
            return fail(400, { newRoleForm });
        }

        return { newRoleForm };
    },
    updateRole: async ({ request, locals: { supabase, safeGetSession } }) => {
        const editRoleForm = await superValidate(request, zod(rolesSchema));

        if (!editRoleForm.valid) {
            return fail(400, { editRoleForm });
        }
        
        const { error } = await supabase
            .from('roles')
            .update({
                role_name: editRoleForm.data.role_name.trim(),
            })
            .eq('id', editRoleForm.data.id)

        if (error) {
            return fail(400, { editRoleForm });
        }

        return { editRoleForm };
    },
};
