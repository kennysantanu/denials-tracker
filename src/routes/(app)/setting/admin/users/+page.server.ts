import { fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { getServerSupabaseUrl } from '$lib/server/supabaseUrl';
import { logAudit } from '$lib/server/audit';
import { logAppEvent } from '$lib/server/appEvents';
import { requirePermission } from '$lib/server/authz';
import { getUsers, createUser, updateUser, deleteUser } from '$lib/server/db/users';
import { getRoles } from '$lib/server/db/roles';
import { setUserActiveRole } from '$lib/server/db/userRoleAssignments';
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

const resetPasswordSchema = z.object({
	id: z.string().min(1, 'User ID is required'),
	password: z.string().min(8, 'Password must be at least 8 characters')
});

const updateEmailSchema = z.object({
	id: z.string().min(1, 'User ID is required'),
	email: z.string().email('Valid email is required')
});

export const load: PageServerLoad = async (event) => {
	const { locals } = event;
	const user = await locals.getUser();
	if (!user) redirect(303, '/signin');

	await requirePermission(event, 'user.read', { resourceType: 'user' });

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
	createUser: async (event) => {
		const { request, locals } = event;
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		await requirePermission(event, 'user.create', { resourceType: 'user' });

		const form = await superValidate(request, zod(createUserSchema));
		if (!form.valid) return fail(400, { createForm: form });

		const adminClient = createClient(getServerSupabaseUrl(), env.SUPABASE_SERVICE_ROLE_KEY);

		// Create auth user
		const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
			email: form.data.email,
			password: form.data.password,
			email_confirm: true
		});

		if (authError) return fail(500, { createForm: form, error: authError.message });

		// handle_new_user() trigger auto-creates public.users row.
		// Set role mirror + create canonical assignment row when a role was chosen.
		if (form.data.role_id) {
			const { error: dbError } = await updateUser(locals.supabase, authData.user.id, {
				role: form.data.role_id
			});
			if (dbError) return fail(500, { createForm: form, error: dbError.message });

			const { error: assignError } = await setUserActiveRole(
				adminClient,
				authData.user.id,
				form.data.role_id,
				user.id,
				'admin: create user'
			);
			if (assignError) return fail(500, { createForm: form, error: assignError.message });
		}

		logAudit(
			locals.supabase,
			user.id,
			'create',
			'user',
			authData.user.id,
			{ email: form.data.email, role_id: form.data.role_id ?? null },
			request
		);
		logAppEvent(locals.supabase, {
			eventName: 'user.create',
			featureArea: 'admin.users',
			outcome: 'success',
			actorUserId: user.id,
			permissionKey: 'user.create',
			permissionSource: 'new',
			resourceType: 'user',
			resourceId: authData.user.id,
			requestId: locals.requestId,
			metadata: { email: form.data.email, role_id: form.data.role_id ?? null }
		});

		return message(form, 'User created successfully');
	},

	updateUser: async (event) => {
		const { request, locals } = event;
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		await requirePermission(event, 'user.update', { resourceType: 'user' });

		const form = await superValidate(request, zod(updateUserSchema));
		if (!form.valid) return fail(400, { updateForm: form });

		const { id, role_id } = form.data;
		const newRole = role_id ?? null;

		// Read previous role for audit + change detection.
		const { data: prevUser } = await locals.supabase
			.from('users')
			.select('role')
			.eq('id', id)
			.maybeSingle();
		const prevRole = prevUser?.role ?? null;

		const { error } = await updateUser(locals.supabase, id, { role: newRole });
		if (error) return fail(500, { updateForm: form, error: error.message });

		// Mirror to user_role_assignments only when the role actually changed.
		if (newRole !== prevRole) {
			const adminClient = createClient(getServerSupabaseUrl(), env.SUPABASE_SERVICE_ROLE_KEY);
			const { error: assignError } = await setUserActiveRole(
				adminClient,
				id,
				newRole,
				user.id,
				'admin: update user role'
			);
			if (assignError) return fail(500, { updateForm: form, error: assignError.message });

			logAppEvent(locals.supabase, {
				eventName: 'user.role_changed',
				featureArea: 'admin.users',
				outcome: 'success',
				actorUserId: user.id,
				permissionKey: 'user.update',
				permissionSource: 'new',
				resourceType: 'user',
				resourceId: id,
				requestId: locals.requestId,
				metadata: { from_role: prevRole, to_role: newRole }
			});
		}

		logAudit(locals.supabase, user.id, 'update', 'user', id, { role_id: newRole }, request);

		return message(form, 'User updated successfully');
	},

	deleteUser: async (event) => {
		const { request, locals } = event;
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		await requirePermission(event, 'user.delete', { resourceType: 'user' });

		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'Invalid user ID' });

		// Prevent self-deletion
		if (id === user.id) return fail(400, { error: 'Cannot delete your own account' });

		const adminClient = createClient(getServerSupabaseUrl(), env.SUPABASE_SERVICE_ROLE_KEY);

		// Delete from public.users first (cascade revokes user_role_assignments).
		const { error: dbError } = await deleteUser(locals.supabase, id);
		if (dbError) return fail(500, { error: dbError.message });

		// Delete auth user
		const { error: authError } = await adminClient.auth.admin.deleteUser(id);
		if (authError) {
			console.error('[admin] Failed to delete auth user:', authError);
		}

		logAudit(locals.supabase, user.id, 'delete', 'user', id, undefined, request);
		logAppEvent(locals.supabase, {
			eventName: 'user.delete',
			featureArea: 'admin.users',
			outcome: 'success',
			actorUserId: user.id,
			permissionKey: 'user.delete',
			permissionSource: 'new',
			resourceType: 'user',
			resourceId: id,
			requestId: locals.requestId
		});

		return { success: true };
	},

	resetPassword: async (event) => {
		const { request, locals } = event;
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		await requirePermission(event, 'user.update', { resourceType: 'user' });

		const form = await superValidate(request, zod(resetPasswordSchema));
		if (!form.valid) return fail(400, { form });

		const { id, password } = form.data;

		const adminClient = createClient(getServerSupabaseUrl(), env.SUPABASE_SERVICE_ROLE_KEY);
		const { error: authError } = await adminClient.auth.admin.updateUserById(id, { password });
		if (authError) return fail(500, { form, error: authError.message });

		logAudit(locals.supabase, user.id, 'update', 'user', id, { password_reset: true }, request);
		logAppEvent(locals.supabase, {
			eventName: 'user.password_reset',
			featureArea: 'admin.users',
			outcome: 'success',
			actorUserId: user.id,
			permissionKey: 'user.update',
			permissionSource: 'new',
			resourceType: 'user',
			resourceId: id,
			requestId: locals.requestId
		});

		return message(form, 'Password reset successfully');
	},

	updateEmail: async (event) => {
		const { request, locals } = event;
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		await requirePermission(event, 'user.update', { resourceType: 'user' });

		const form = await superValidate(request, zod(updateEmailSchema));
		if (!form.valid) return fail(400, { form });

		const { id, email } = form.data;

		const adminClient = createClient(getServerSupabaseUrl(), env.SUPABASE_SERVICE_ROLE_KEY);
		const { error: authError } = await adminClient.auth.admin.updateUserById(id, {
			email,
			email_confirm: true
		});
		if (authError) return fail(500, { form, error: authError.message });

		// Keep public.users.username mirrored to the email (matches handle_new_user trigger).
		const { error: dbError } = await updateUser(locals.supabase, id, {
			username: email.replace('@supabase', '')
		});
		if (dbError) return fail(500, { form, error: dbError.message });

		logAudit(locals.supabase, user.id, 'update', 'user', id, { email }, request);
		logAppEvent(locals.supabase, {
			eventName: 'user.email_changed',
			featureArea: 'admin.users',
			outcome: 'success',
			actorUserId: user.id,
			permissionKey: 'user.update',
			permissionSource: 'new',
			resourceType: 'user',
			resourceId: id,
			requestId: locals.requestId,
			metadata: { email }
		});

		return message(form, 'Email updated successfully');
	}
};
