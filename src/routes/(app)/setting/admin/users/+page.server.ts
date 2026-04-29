import { fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { getServerSupabaseUrl } from '$lib/server/supabaseUrl';
import { logAudit } from '$lib/server/audit';
import { getUsers, createUser, updateUser, deleteUser } from '$lib/server/db/users';
import { getRoles } from '$lib/server/db/roles';
import type { PageServerLoad, Actions } from './$types';

const createUserSchema = z.object({
	email: z.string().email('Valid email is required'),
	password: z.string().min(8, 'Password must be at least 8 characters'),
	role_id: z.coerce.number().optional()
});

const updateUserSchema = z.object({
	id: z.string().min(1, 'User ID is required'),
	role_id: z.coerce.number().optional()
});

export const load: PageServerLoad = async ({ locals }) => {
	const user = await locals.getUser();
	if (!user) redirect(303, '/signin');

	const { data: users } = await getUsers(locals.supabase);
	const { data: roles } = await getRoles(locals.supabase);

	const createForm = await superValidate(zod(createUserSchema));
	const updateForm = await superValidate(zod(updateUserSchema));

	return {
		users: users ?? [],
		roles: roles ?? [],
		createForm,
		updateForm
	};
};

export const actions: Actions = {
	createUser: async ({ request, locals }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const form = await superValidate(request, zod(createUserSchema));
		if (!form.valid) return fail(400, { createForm: form });

		const adminClient = createClient(getServerSupabaseUrl(), SUPABASE_SERVICE_ROLE_KEY);

		// Create auth user
		const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
			email: form.data.email,
			password: form.data.password,
			email_confirm: true
		});

		if (authError) return fail(500, { createForm: form, error: authError.message });

		// handle_new_user() trigger auto-creates public.users row
		// Just update the role if specified
		if (form.data.role_id) {
			const { error: dbError } = await updateUser(locals.supabase, authData.user.id, {
				role: form.data.role_id
			});
			if (dbError) return fail(500, { createForm: form, error: dbError.message });
		}

		logAudit(locals.supabase, user.id, 'create', 'user', authData.user.id, { email: form.data.email }, request);

		return message(form, 'User created successfully');
	},

	updateUser: async ({ request, locals }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const form = await superValidate(request, zod(updateUserSchema));
		if (!form.valid) return fail(400, { updateForm: form });

		const { id, ...rest } = form.data;
		const { error } = await updateUser(locals.supabase, id, { role: rest.role_id ?? null });
		if (error) return fail(500, { updateForm: form, error: error.message });

		logAudit(locals.supabase, user.id, 'update', 'user', id, rest, request);

		return message(form, 'User updated successfully');
	},

	deleteUser: async ({ request, locals }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'Invalid user ID' });

		// Prevent self-deletion
		if (id === user.id) return fail(400, { error: 'Cannot delete your own account' });

		const adminClient = createClient(getServerSupabaseUrl(), SUPABASE_SERVICE_ROLE_KEY);

		// Delete from public.users first
		const { error: dbError } = await deleteUser(locals.supabase, id);
		if (dbError) return fail(500, { error: dbError.message });

		// Delete auth user
		const { error: authError } = await adminClient.auth.admin.deleteUser(id);
		if (authError) {
			console.error('[admin] Failed to delete auth user:', authError);
		}

		logAudit(locals.supabase, user.id, 'delete', 'user', id, undefined, request);

		return { success: true };
	}
};
