import { superValidate, message } from 'sveltekit-superforms';
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
    const form = await superValidate(zod(schema));

    return { form };

}) satisfies PageServerLoad;

// Form actions
export const actions: Actions = {
    createAdmin: async ({ request, locals: { supabase, safeGetSession } }) => {        
        const form = await superValidate(request, zod(schema));

        if (!form.valid) {
            return message(form, 'Form not valid!');
        }

        const { data: signupData, error: signupError } = await supabase.auth.signUp({
            email: 'admin' + '@supabase',
            password: form.data.password			
        })
                      
        if (signupError) {
            return message(form, 'Administrator account already exists!');
        }
    
        const { error: roleError } = await supabase
            .from('roles')
            .insert([
                { role_name: 'Administrator', permissions: [1,2,3] },
            ])
        
        if (!signupData.user) {
            return message(form, 'Error creating Administrator account!');     
        }
    
        const { error: updateError } = await supabase
            .from('users')
            .update({ role: 1 })
            .eq('id', signupData.user.id)
    
        if (updateError) {
            return message(form, 'Error assigning role to Administrator account!');
        }

        return message(form, 'Administrator account created!');
    },
};
