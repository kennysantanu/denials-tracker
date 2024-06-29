import { superValidate, fail } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import type { PageServerLoad, Actions } from './$types';

// Form schema
const schemaEditLabelForm = z.object({
    label_id: z.number(),
    label_name: z.string(),
    bg_color: z.string(),
    txt_color: z.string(),
});

const schemaNewLabelForm = z.object({
    order: z.number(),
    label_name: z.string(),
    bg_color: z.string(),
    txt_color: z.string(),
});

// Server load function
export const load = (async ({ locals: { supabase, safeGetSession } }) => {
    const editLabelForm = await superValidate(zod(schemaEditLabelForm));
    editLabelForm.data.bg_color = '#dee2ed';
    editLabelForm.data.txt_color = '#000000';

    const newLabelForm = await superValidate(zod(schemaNewLabelForm));
    newLabelForm.data.bg_color = '#dee2ed';
    newLabelForm.data.txt_color = '#000000';
    
    let { data: labels, error } = await supabase
    .from('labels')
    .select('*')
    .order('order', { ascending: true });      

    return { editLabelForm, newLabelForm, labels: labels || []};
}) satisfies PageServerLoad;

// Form actions
export const actions: Actions = {
    updateLabel: async ({ request, locals: { supabase, safeGetSession } }) => {
        const form = await superValidate(request, zod(schemaEditLabelForm));

        if (!form.valid) {
            return fail(400, { form });
        }
        
        const { data, error } = await supabase
            .from('labels')
            .update({
                label_name: form.data.label_name.trim(), 
                bg_color: form.data.bg_color, 
                txt_color: form.data.txt_color })
            .eq('id', form.data.label_id)

        if (error) {
            return fail(400, { form });
        }

        return form;
    },
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
