import { fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { passwordSchema } from '$lib/schemas/auth';
import { logAudit } from '$lib/server/audit';
import type { PageServerLoad, Actions } from './$types';

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

		const form = await superValidate(zod(changePasswordSchema));

		return { form, expired: url.searchParams.get('expired') === '1' };
};

export const actions: Actions = {
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
