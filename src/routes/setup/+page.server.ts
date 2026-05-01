import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { passwordSchema } from '$lib/schemas/auth';
import { getServerSupabaseUrl } from '$lib/server/supabaseUrl';
import { isSystemInitialized } from '$lib/server/setupState';
import { logAudit } from '$lib/server/audit';
import type { Database } from '$lib/supabase';
import type { Actions, PageServerLoad } from './$types';

const setupSchema = z
	.object({
		email: z.string().email('Please enter a valid email address'),
		password: passwordSchema,
		confirmPassword: z.string()
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword']
	});

export const load: PageServerLoad = async () => {
	if (await isSystemInitialized()) {
		redirect(303, '/signin');
	}

	const form = await superValidate(zod(setupSchema));
	return { form };
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		// Re-check guard inside the action so a race between two concurrent
		// /setup posts cannot create a second "first" admin.
		if (await isSystemInitialized()) {
			redirect(303, '/signin');
		}

		const form = await superValidate(request, zod(setupSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		const email = form.data.email;
		const password = form.data.password;

		// Use the service-role admin client so we can:
		//   1. Auto-confirm the email (no SMTP required for self-hosted installs).
		//   2. Update public.users.role bypassing RLS during a moment when no
		//      admin yet exists to satisfy the "manage_users" policy.
		const adminClient = createClient<Database>(
			getServerSupabaseUrl(),
			env.SUPABASE_SERVICE_ROLE_KEY
		);

		const { data: created, error: createError } = await adminClient.auth.admin.createUser({
			email,
			password,
			email_confirm: true,
			user_metadata: { username: email.split('@')[0] }
		});

		if (createError || !created.user) {
			return fail(400, {
				form,
				error: createError?.message ?? 'Failed to create administrator account.'
			});
		}

		const newUserId = created.user.id;

		// Look up the seeded "Administrator" role (see migration
		// 20260429000001_seed_administrator_role.sql).
		const { data: adminRole, error: roleError } = await adminClient
			.from('roles')
			.select('id')
			.eq('role_name', 'Administrator')
			.maybeSingle();

		if (roleError || !adminRole) {
			// Best-effort cleanup so /setup can be retried.
			await adminClient.auth.admin.deleteUser(newUserId).catch(() => {});
			return fail(500, {
				form,
				error:
					'Administrator role not found. Run database migrations (`supabase/migrate.sh`) and try again.'
			});
		}

		// Assign the Administrator role to the user row that handle_new_user()
		// just created via the auth.users insert trigger.
		const { error: assignError } = await adminClient
			.from('users')
			.update({ role: adminRole.id })
			.eq('id', newUserId);

		if (assignError) {
			await adminClient.auth.admin.deleteUser(newUserId).catch(() => {});
			return fail(500, {
				form,
				error: `Failed to assign administrator role: ${assignError.message}`
			});
		}

		// Sign the new admin in on the user's session so they land on the
		// dashboard already authenticated.
		const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

		logAudit(
			supabase,
			newUserId,
			'admin_setup',
			'user',
			newUserId,
			{ email, role_id: adminRole.id },
			request
		);

		if (signInError) {
			// Account exists and is usable — just couldn't auto-login.
			redirect(303, '/signin');
		}

		redirect(303, '/dashboard');
	}
};
