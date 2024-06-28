import { superValidate, fail } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import type { PageServerLoad, Actions } from './$types';

// Form schema
const schemaNewLabelForm = z.object({
    order: z.number(),
    label_name: z.string(),
    bg_color: z.string(),
    txt_color: z.string(),
});

// Server load function
export const load = (async ({ locals: { supabase, safeGetSession } }) => {
    const newLabelForm = await superValidate(zod(schemaNewLabelForm));
    newLabelForm.data.bg_color = '#dee2ed';
    newLabelForm.data.txt_color = '#000000';
    
    let { data: labels, error } = await supabase
    .from('labels')
    .select('*')
    .order('order', { ascending: true });      

    return { newLabelForm, labels: labels || []};
}) satisfies PageServerLoad;

// Form actions
export const actions: Actions = {
    createLabel: async ({ request, locals: { supabase, safeGetSession } }) => {
        const form = await superValidate(request, zod(schemaNewLabelForm));

        if (!form.valid) {
            return fail(400, { form });
        }

        let { count, error: countError } = await supabase
        .from('labels')
        .select('*', { count: 'exact', head: true })

        if (countError) {
            return fail(400, { form });
        }

        if (count) {
            count = count + 1;
        }        

        const { data, error } = await supabase
            .from('labels')
            .insert([
            { 
                order: count, 
                label_name: form.data.label_name.trim(), 
                bg_color: form.data.bg_color, 
                txt_color: form.data.txt_color},
            ])
                      
        if (error) {
            return fail(400, { form });
        }

        return form;
    },
};
