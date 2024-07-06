import { superValidate, fail } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import type { PageServerLoad, Actions } from './$types';

// Form schema
const patientsSchema = z.object({
    id: z.number(),
    last_name: z.string(),
    first_name: z.string(),
    date_of_birth: z.date(),
    note: z.string().optional(),
});

// Server load function
export const load = (async ({ locals: { supabase, safeGetSession } }) => {
    const updatePatientForm = await superValidate(zod(patientsSchema));
    
    let { data: patients } = await supabase
    .from('patients')
    .select('*') 
    .order('last_name', { ascending: true })       

    return { updatePatientForm, patients: patients || []};
}) satisfies PageServerLoad;

// Form actions
export const actions: Actions = {
    updatePatient: async ({ request, locals: { supabase, safeGetSession } }) => {
        const updatePatientForm = await superValidate(request, zod(patientsSchema));

        if (!updatePatientForm.valid) {
            return fail(400, { updatePatientForm });
        }
        
        const { error } = await supabase
            .from('patients')
            .update({
                last_name: updatePatientForm.data.last_name.trim().toUpperCase(),
                first_name: updatePatientForm.data.first_name.trim().toUpperCase(),
                date_of_birth: updatePatientForm.data.date_of_birth                
            })
            .eq('id', updatePatientForm.data.id)

        if (error) {
            return fail(400, { updatePatientForm });
        }

        return { updatePatientForm };
    },
};
