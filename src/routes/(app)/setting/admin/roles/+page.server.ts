import { superValidate, fail } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import type { PageServerLoad, Actions } from './$types';

// Form schema
const rolesSchema = z.object({
    id: z.number(),
    role_name: z.string(),
    permissions: z.object({
        denial_read: z.boolean().optional(),
        denial_create: z.boolean().optional(),
        denial_edit: z.boolean().optional(),
        denial_delete: z.boolean().optional(),
        note_create: z.boolean().optional(),
        note_edit: z.boolean().optional(),
        note_delete: z.boolean().optional(),
        attachment_add: z.boolean().optional(),
        attachment_remove: z.boolean().optional(),
        file_read: z.boolean().optional(),
        file_upload: z.boolean().optional(),
        file_edit: z.boolean().optional(),
        file_delete: z.boolean().optional(),
        admin_read: z.boolean().optional(),
    })
});

// Server load function
export const load = (async ({ locals: { supabase, safeGetSession } }) => {
    let newRoleForm = await superValidate(zod(rolesSchema));
    const editRoleForm = await superValidate(zod(rolesSchema));
    const deleteRoleForm = await superValidate(zod(rolesSchema));

    const permissions = 
            {
                denial_read: true,
                denial_create: false,
                denial_edit: false,
                denial_delete: false,
                note_create: false,
                note_edit: false,
                note_delete: false,
                attachment_add: false,
                attachment_remove: false,
                file_read: true,
                file_upload: false,
                file_edit: false,
                file_delete: false,
                admin_read: false,
            }
        ;

    newRoleForm.data.permissions = permissions;
    
    let { data: roles } = await supabase
    .from('roles')
    .select('id, role_name, permissions') 
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

        const permissions = 
            {
                denial_read: newRoleForm.data.permissions.denial_read,
                denial_create: newRoleForm.data.permissions.denial_create,
                denial_edit: newRoleForm.data.permissions.denial_edit,
                denial_delete: newRoleForm.data.permissions.denial_delete,
                note_create: newRoleForm.data.permissions.note_create,
                note_edit: newRoleForm.data.permissions.note_edit,
                note_delete: newRoleForm.data.permissions.note_delete,
                attachment_add: newRoleForm.data.permissions.attachment_add,
                attachment_remove: newRoleForm.data.permissions.attachment_remove,
                file_read: newRoleForm.data.permissions.file_read,
                file_upload: newRoleForm.data.permissions.file_upload,
                file_edit: newRoleForm.data.permissions.file_edit,
                file_delete: newRoleForm.data.permissions.file_delete,
                admin_read: newRoleForm.data.permissions.admin_read,
            }
        ;

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

        const permissions = 
            {
                denial_read: editRoleForm.data.permissions.denial_read,
                denial_create: editRoleForm.data.permissions.denial_create,
                denial_edit: editRoleForm.data.permissions.denial_edit,
                denial_delete: editRoleForm.data.permissions.denial_delete,
                note_create: editRoleForm.data.permissions.note_create,
                note_edit: editRoleForm.data.permissions.note_edit,
                note_delete: editRoleForm.data.permissions.note_delete,
                attachment_add: editRoleForm.data.permissions.attachment_add,
                attachment_remove: editRoleForm.data.permissions.attachment_remove,
                file_read: editRoleForm.data.permissions.file_read,
                file_upload: editRoleForm.data.permissions.file_upload,
                file_edit: editRoleForm.data.permissions.file_edit,
                file_delete: editRoleForm.data.permissions.file_delete,
                admin_read: editRoleForm.data.permissions.admin_read,
            }
        ;
        
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
