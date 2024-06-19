import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { fail } from '@sveltejs/kit';

const schema = z.object({
	username: z.string(),
	password: z.string()
  });

export const load = async ({ request, locals: { supabase, safeGetSession } }) => {
	const form = await superValidate(zod(schema));
	const { session } = await safeGetSession();

	if (session) {
		const { data: user } = await supabase
		.from('users')
		.select('username')
		.eq('id', session.user.id)
		.single()
		return { session, user, form };
	}
	else {
		return { session, form };
	}
}

export const actions = {
	signup: async ({ request, locals: { supabase, safeGetSession } }) => {
		const form = await superValidate(request, zod(schema));

		if (!form.valid) {
		return fail(400, { form });
		}

		const { data, error } = await supabase.auth.signUp({
			email: form.data.username + '@supabase',
			password: form.data.password,
			options: {
				data: {
					username: form.data.username
				},
			},
		})
	}
};