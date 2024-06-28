import { superValidate, fail } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import type { PageServerLoad, Actions } from './$types';

// Form schema
const schemaNewUserForm = z.object({
    username: z.string(),
	password: z.string().min(6),
    role: z.number(),
});

// Server load function
export const load = (async ({ locals: { supabase, safeGetSession } }) => {
    const newUserForm = await superValidate(zod(schemaNewUserForm));
    
	let { data: usersData, error: usersError } = await supabase
	.from('users')
	.select('username')

    let { data: rolesData, error: rolesError } = await supabase
    .from('roles')
    .select('id, role_name')

    return { newUserForm, usersData: usersData || [], rolesData: rolesData || []};
}) satisfies PageServerLoad;

// Form actions
export const actions: Actions = {
    createUser: async ({ request, locals: { supabase, safeGetSession } }) => {
        const form = await superValidate(request, zod(schemaNewUserForm));

        if (!form.valid) {
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
        
            const { data: updateData, error: updateError } = await supabase
            .from('users')
            .update({ username: form.data.username, role: form.data.role })
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
