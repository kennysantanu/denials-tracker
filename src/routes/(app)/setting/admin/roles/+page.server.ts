import { superValidate, fail } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import type { PageServerLoad, Actions } from './$types';

// Form schema
const rolesSchema = z.object({
    id: z.number(),
    role_name: z.string(),
    permissions_1: z.string().optional(),
    permissions_2: z.string().optional(),
    permissions_3: z.string().optional(),
});

// Server load function
export const load = (async ({ locals: { supabase, safeGetSession } }) => {
    const newRoleForm = await superValidate(zod(rolesSchema));
    const editRoleForm = await superValidate(zod(rolesSchema));
    const deleteRoleForm = await superValidate(zod(rolesSchema));
    
    let { data: roles } = await supabase
    .from('roles')
    .select('*') 
    .order('id', { ascending: true })       

    return { newRoleForm, editRoleForm, deleteRoleForm, roles: roles || []};
}) satisfies PageServerLoad;

// Form actions
export const actions: Actions = {
    createRole: async ({ request, locals: { supabase, safeGetSession } }) => {
        const newRoleForm = await superValidate(request, zod(rolesSchema));

        if (!newRoleForm.valid) {
            return fail(400, { newRoleForm });
        }

        let permissions: Number[] = [];

        if (newRoleForm.data.permissions_1 === 'on') {
            permissions.push(1);
        }
        if (newRoleForm.data.permissions_2 === 'on') {
            permissions.push(2);
        }
        if (newRoleForm.data.permissions_3 === 'on') {
            permissions.push(3);
        }

        const { error } = await supabase
            .from('roles')
            .insert([
            { role_name: newRoleForm.data.role_name.trim(), permissions: permissions},
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

        if (editRoleForm.data.id === 1) {
            return fail(400, { editRoleForm });
        }

        let permissions: Number[] = [];

        if (editRoleForm.data.permissions_1 === 'on') {
            permissions.push(1);
        }
        if (editRoleForm.data.permissions_2 === 'on') {
            permissions.push(2);
        }
        if (editRoleForm.data.permissions_3 === 'on') {
            permissions.push(3);
        }
        
        const { error } = await supabase
            .from('roles')
            .update({
                role_name: editRoleForm.data.role_name.trim(),
                permissions: permissions
            })
            .eq('id', editRoleForm.data.id)

        if (error) {
            return fail(400, { editRoleForm });
        }

        return { editRoleForm };
    },
    deleteRole: async ({ request, locals: { supabase, safeGetSession } }) => {
        const deleteRoleForm = await superValidate(request, zod(rolesSchema));

        if (!deleteRoleForm.valid) {
            return fail(400, { deleteRoleForm });
        }
        
        const { error } = await supabase
            .from('roles')
            .delete()
            .eq('id', deleteRoleForm.data.id)

        if (error) {
            return fail(400, { deleteRoleForm });
        }
        
        return { deleteRoleForm };
    },
};
