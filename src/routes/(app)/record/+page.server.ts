import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { fail } from '@sveltejs/kit';

const schemaNewPatient = z.object({
    last_name: z.string(),
    first_name: z.string(),
    date_of_birth: z.date(),
});

export const load = async ({ request, locals: { supabase, safeGetSession } }) => {	
    
    let { data: patients, error } = await supabase
    .from('patients')
    .select('*')
    .order('last_name', { ascending: true })
    
    return { patients: patients || [] }
}

export const actions = {
	addNewPatient: async ({ request, locals: { supabase, safeGetSession } }) => {        
		const form = await superValidate(request, zod(schemaNewPatient));

        if (!form.valid) {
            return fail(400, { form });
        }

        const { data, error } = await supabase
            .from('patients')
            .insert([
                { 
                    last_name: form.data.last_name.trim().toUpperCase(), 
                    first_name: form.data.first_name.trim().toUpperCase(), 
                    date_of_birth: form.data.date_of_birth
                },
            ])
        
        if (error) {
            return fail(400, { form });
        }

        return { form };

    }

}