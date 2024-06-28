import { redirect } from '@sveltejs/kit';
import { superValidate, fail } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import type { PageServerLoad, Actions } from './$types';

// Form schema
const schema = z.object({
    username: z.string(),
	password: z.string().min(6),
});

// Server load function
export const load = (async ({ locals: { supabase } }) => {

    // Check if there is a user
    let { count } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })

    if (count === null || count > 0 ) {
        return redirect(303, '/')
    }

    const form = await superValidate(zod(schema));

    return { form };
}) satisfies PageServerLoad;

// Form actions
export const actions: Actions = {
    createAdmin: async ({ request, locals: { supabase, safeGetSession } }) => {
        const form = await superValidate(request, zod(schema));

        if (!form.valid) {
            return fail(400, { form });
        }

        const { error: rolesError } = await supabase
            .from('roles')
            .insert([
            { role_name: 'Administrator' },
            ])

        if (rolesError) {
            return fail(400, { form });
        }
                
        const { data: signupData, error: signupError } = await supabase.auth.signUp({
			email: form.data.username + '@supabase',
			password: form.data.password			
		})
                      
        if (signupError) {
            return fail(400, { form });
        }

        if (signupData.user) {
        
            const { error: updateError } = await supabase
            .from('users')
            .update({ role: 1 })
            .eq('id', signupData.user.id)

            if (updateError) {
                return fail(400, { form });
            }
        }
        else {
            return fail(400, { form });
        }

        return form;
    },
};
