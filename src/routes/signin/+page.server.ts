import { redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { fail } from '@sveltejs/kit';

const schema = z.object({
	username: z.string(),
	password: z.string()
  });

export const load = async ({ request, locals: { supabase, safeGetSession } }) => {	
	const { session } = await safeGetSession();
	
	if (session) {
		redirect(303, '/record')
	}
	else {
		const form = await superValidate(zod(schema));
		return { session, form };
	}
}

export const actions = {
	signin: async ({ request, locals: { supabase, safeGetSession } }) => {
		const form = await superValidate(request, zod(schema));

		if (!form.valid) {
		// Again, return { form } and things will just work.
		return fail(400, { form });
		}

		// TODO: Do something with the validated form.data
		let { data, error } = await supabase.auth.signInWithPassword({
			email: form.data.username + '@supabase',
			password: form.data.password
		})

		if (error) {
			return fail(400, { form });
		}
		
		// Redirect to the home page
		redirect(302, '/auth/callback');
	},
	signout: async ({ locals: { supabase } }) => {
		let { error } = await supabase.auth.signOut()
	}
};