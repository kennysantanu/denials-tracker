import { superValidate, message, fail } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import type { PageServerLoad, Actions } from './$types';

// Superforms schema
const insurancesSchema = z.object({
    id: z.number(),
    name: z.string(),
    note: z.string().optional(),
});

// Server load function
export const load: PageServerLoad = (async ({ locals: { supabase, safeGetSession } }) => {
    const createInsuranceForm = await superValidate(zod(insurancesSchema));
    const updateInsuranceForm = await superValidate(zod(insurancesSchema));
    const deleteInsuranceForm = await superValidate(zod(insurancesSchema));
    
    let { data: insurances } = await supabase
    .from('insurances')
    .select('*') 
    .order('name', { ascending: true })       

    return { createInsuranceForm, updateInsuranceForm, deleteInsuranceForm, insurances: insurances || []};
});

// Form actions
export const actions: Actions = {
    createInsurance: async ({ request, locals: { supabase, safeGetSession } }) => {
        const createInsuranceForm = await superValidate(request, zod(insurancesSchema));

        if (!createInsuranceForm.valid) {
            return fail(400, { createInsuranceForm });
        }

        const { error } = await supabase
            .from('insurances')
            .insert({
                name: createInsuranceForm.data.name.trim(),
                note: createInsuranceForm.data.note
            })

        if (error) {
            return fail(400, { createInsuranceForm });
        }

        return message(createInsuranceForm, 'Insurance added successfully!');
    },
    updateInsurance: async ({ request, locals: { supabase, safeGetSession } }) => {
        const updateInsuranceForm = await superValidate(request, zod(insurancesSchema));

        if (!updateInsuranceForm.valid) {
            return fail(400, { updateInsuranceForm });
        }
        
        const { error } = await supabase
            .from('insurances')
            .update({
                name: updateInsuranceForm.data.name.trim(),
                note: updateInsuranceForm.data.note
            })
            .eq('id', updateInsuranceForm.data.id)

        if (error) {
            return fail(400, { updateInsuranceForm });
        }

        return message(updateInsuranceForm, 'Insurance updated successfully!');
    },
    deleteInsurance: async ({ request, locals: { supabase, safeGetSession } }) => {
        const deleteInsuranceForm = await superValidate(request, zod(insurancesSchema));

        const { error } = await supabase
            .from('insurances')
            .delete()
            .eq('id', deleteInsuranceForm.data.id)

        if (error) {
            return fail(400, { deleteInsuranceForm });
        }
        
        return message(deleteInsuranceForm, 'Insurance deleted successfully!');
    }
};
