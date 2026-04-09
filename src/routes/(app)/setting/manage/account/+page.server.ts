import { fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { logAudit } from '$lib/server/audit';
import type { PageServerLoad, Actions } from './$types';

const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(8, 'Current password must be at least 8 characters'),
		newPassword: z.string().min(8, 'New password must be at least 8 characters'),
		confirmPassword: z.string().min(8, 'Confirm password must be at least 8 characters')
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword']
	});

export const load: PageServerLoad = async ({ locals }) => {
	const user = await locals.getUser();
	if (!user) redirect(303, '/signin');

	const form = await superValidate(zod(changePasswordSchema));

	return { form };
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

		logAudit(locals.supabase, user.id, 'update', 'user', user.id, { action: 'change_password' }, request);

		return message(form, 'Password updated successfully');
	}
};
