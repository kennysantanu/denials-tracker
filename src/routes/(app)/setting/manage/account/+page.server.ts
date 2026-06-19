import { fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { passwordSchema } from '$lib/schemas/auth';
import { logAudit } from '$lib/server/audit';
import { updateUser } from '$lib/server/db/users';
import type { PageServerLoad, Actions } from './$types';

const updateUsernameSchema = z.object({
	username: z.string().trim().min(1, 'Username is required').max(100, 'Username is too long')
});

const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, 'Current password is required'),
		newPassword: passwordSchema,
		confirmPassword: z.string().min(1, 'Please confirm your new password')
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword']
	});

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = await locals.getUser();
	if (!user) redirect(303, '/signin');

	const [{ data: profile }, form] = await Promise.all([
		locals.supabase.from('users').select('username').eq('id', user.id).single(),
		superValidate(zod(changePasswordSchema))
	]);

	return {
		form,
		username: profile?.username ?? '',
		expired: url.searchParams.get('expired') === '1'
	};
};

export const actions: Actions = {
	updateUsername: async ({ request, locals }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const formData = await request.formData();
		const parsed = updateUsernameSchema.safeParse({
			username: formData.get('username')
		});

		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0]?.message ?? 'Invalid username' });
		}

		const { username } = parsed.data;
		const { error } = await updateUser(locals.supabase, user.id, { username });
		if (error) return fail(500, { error: error.message });

		logAudit(locals.supabase, user.id, 'update', 'user', user.id, { username }, request);

		return { success: true, username };
	},

	changePassword: async ({ request, locals }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const form = await superValidate(request, zod(changePasswordSchema));
		if (!form.valid) {
			return fail(400, { form });
		}

		const { currentPassword, newPassword } = form.data;

		// Verify current password
		const { error: signInError } = await locals.supabase.auth.signInWithPassword({
			email: user.email!,
			password: currentPassword
		});

		if (signInError) {
			return fail(400, {
				form,
				error: 'Current password is incorrect'
			});
		}

		// Update password
		const { error: updateError } = await locals.supabase.auth.updateUser({
			password: newPassword
		});

		if (updateError) {
			return fail(500, {
				form,
				error: 'Failed to update password'
			});
		}

		// Update password_changed_at timestamp
		await locals.supabase
			.from('users')
			.update({ password_changed_at: new Date().toISOString() })
			.eq('id', user.id);

		logAudit(locals.supabase, user.id, 'update', 'user', user.id, { action: 'change_password' }, request);

		return message(form, 'Password updated successfully');
	}
};
