import { superValidate, fail } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import type { PageServerLoad, Actions } from './$types';

// Form schema
const rolesSchema = z.object({
    id: z.number(),
    role_name: z.string(),
    record_read: z.boolean().optional(),
    record_write: z.boolean().optional(),
    record_delete: z.boolean().optional(),
    admin_read: z.boolean().optional(),
    admin_write: z.boolean().optional(),
    admin_delete: z.boolean().optional()
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

        const permissions = [
            {
                page: "record",
                permissions: {
                    read: newRoleForm.data.record_read,
                    write: newRoleForm.data.record_write,
                    delete: newRoleForm.data.record_delete
                }
            },
            {
                page: "admin",
                permissions: {
                    read: newRoleForm.data.admin_read,
                    write: newRoleForm.data.admin_write,
                    delete: newRoleForm.data.admin_delete
                }
            }
        ];

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

        const permissions = [
            {
                page: "record",
                permissions: {
                    read: editRoleForm.data.record_read,
                    write: editRoleForm.data.record_write,
                    delete: editRoleForm.data.record_delete
                }
            },
            {
                page: "admin",
                permissions: {
                    read: editRoleForm.data.admin_read,
                    write: editRoleForm.data.admin_write,
                    delete: editRoleForm.data.admin_delete
                }
            }
        ];
        
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
