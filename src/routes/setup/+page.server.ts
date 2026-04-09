import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { passwordSchema } from '$lib/schemas/auth';
import type { Actions, PageServerLoad } from './$types';

const setupSchema = z.object({
	email: z.string().email('Please enter a valid email address'),
	password: passwordSchema,
	confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
	message: 'Passwords do not match',
	path: ['confirmPassword']
});

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	// Guard: only accessible when no users exist
	const { count } = await supabase
		.from('users')
		.select('*', { count: 'exact', head: true });

	if (count !== null && count > 0) {
		redirect(303, '/signin');
	}

	const form = await superValidate(zod(setupSchema));
	return { form };
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		// Re-check guard
		const { count } = await supabase
			.from('users')
			.select('*', { count: 'exact', head: true });

		if (count !== null && count > 0) {
			redirect(303, '/signin');
		}

		const form = await superValidate(request, zod(setupSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		const email = form.data.email as string;
		const password = form.data.password as string;

		// Create the admin user via Supabase Auth
		// The handle_new_user() trigger auto-creates the public.users row
		const { error } = await supabase.auth.signUp({
			email,
			password
		});

		if (error) {
			return fail(400, {
				form,
				error: error.message
			});
		}

		redirect(303, '/signin');
	}
};
