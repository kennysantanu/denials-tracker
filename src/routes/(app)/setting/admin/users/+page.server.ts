import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { PRIVATE_SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import { createClient } from '@supabase/supabase-js'
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
    const resetUserPasswordForm = await superValidate(zod(schemaNewUserForm));
    
	let { data: usersData, error: usersError } = await supabase
	.from('users')
	.select('username')

    let { data: rolesData, error: rolesError } = await supabase
    .from('roles')
    .select('id, role_name')

    return { newUserForm, resetUserPasswordForm, usersData: usersData || [], rolesData: rolesData || []};
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
            .update({ role: form.data.role })
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
    resetUserPassword: async ({ request }) => {
        const resetUserPasswordForm = await superValidate(request, zod(schemaNewUserForm));

        if (!resetUserPasswordForm.valid) {
            return fail(400, { resetUserPasswordForm });
        }

        const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_ROLE_KEY);   

        const { data: usersData, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, username')

        if (usersError) {
            return fail(400, { resetUserPasswordForm });
        }

        let userId = '';
        usersData.forEach((user) => {
            console.log(user.username);
            if (user.username === resetUserPasswordForm.data.username) {
                userId = user.id;
            }
        });

        if (userId === '') {
            return fail(400, { resetUserPasswordForm });
        }

        await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { password: resetUserPasswordForm.data.password }
          )

        return resetUserPasswordForm;
    },
};
