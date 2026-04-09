import { fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { logAudit } from '$lib/server/audit';
import { getRoles, createRole, updateRole, deleteRole } from '$lib/server/db/roles';
import type { PageServerLoad, Actions } from './$types';

const permissionKeys = [
	'view_denials', 'create_denial', 'update_denial', 'delete_denial',
	'view_reports', 'export_reports',
	'manage_patients', 'manage_insurances',
	'generate_summary', 'generate_appeal',
	'manage_users', 'manage_roles', 'manage_labels',
	'audit_read', 'admin'
] as const;

const createRoleSchema = z.object({
	role_name: z.string().min(1, 'Role name is required'),
	permissions: z.string().min(1, 'Permissions JSON is required')
});

const updateRoleSchema = z.object({
	id: z.coerce.number(),
	role_name: z.string().min(1, 'Role name is required'),
	permissions: z.string().min(1, 'Permissions JSON is required')
});

export const load: PageServerLoad = async ({ locals }) => {
	const user = await locals.getUser();
	if (!user) redirect(303, '/signin');

	const { data: roles } = await getRoles(locals.supabase);

	const createForm = await superValidate(zod(createRoleSchema));
	const updateForm = await superValidate(zod(updateRoleSchema));

	return {
		roles: roles ?? [],
		permissionKeys: [...permissionKeys],
		createForm,
		updateForm
	};
};

export const actions: Actions = {
	createRole: async ({ request, locals }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const form = await superValidate(request, zod(createRoleSchema));
		if (!form.valid) return fail(400, { createForm: form });

		let permissions: Record<string, boolean>;
		try {
			permissions = JSON.parse(form.data.permissions);
		} catch {
			return fail(400, { createForm: form, error: 'Invalid permissions JSON' });
		}

		const { data: role, error } = await createRole(locals.supabase, {
			role_name: form.data.role_name,
			permissions
		});
		if (error) return fail(500, { createForm: form, error: error.message });

		logAudit(locals.supabase, user.id, 'create', 'role', String(role?.id), { role_name: form.data.role_name }, request);

		return message(form, 'Role created successfully');
	},

	updateRole: async ({ request, locals }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const form = await superValidate(request, zod(updateRoleSchema));
		if (!form.valid) return fail(400, { updateForm: form });

		let permissions: Record<string, boolean>;
		try {
			permissions = JSON.parse(form.data.permissions);
		} catch {
			return fail(400, { updateForm: form, error: 'Invalid permissions JSON' });
		}

		const { id, role_name } = form.data;
		const { error } = await updateRole(locals.supabase, id, { role_name, permissions });
		if (error) return fail(500, { updateForm: form, error: error.message });

		logAudit(locals.supabase, user.id, 'update', 'role', String(id), { role_name }, request);

		return message(form, 'Role updated successfully');
	},

	deleteRole: async ({ request, locals }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const formData = await request.formData();
		const id = Number(formData.get('id'));
		if (!id) return fail(400, { error: 'Invalid role ID' });

		const { error } = await deleteRole(locals.supabase, id);
		if (error) return fail(500, { error: error.message });

		logAudit(locals.supabase, user.id, 'delete', 'role', String(id), undefined, request);

		return { success: true };
	}
};
