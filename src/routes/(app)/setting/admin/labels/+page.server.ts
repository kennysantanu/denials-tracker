import { superValidate, fail } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import type { PageServerLoad, Actions } from './$types';

// Superforms schema
const labelsSchema = z.object({
    id: z.number(),
    order: z.number(),
    label_name: z.string(),
    bg_color: z.string(),
    txt_color: z.string(),
});

// Server load function
export const load = (async ({ locals: { supabase, safeGetSession } }) => {
    const editLabelForm = await superValidate(zod(labelsSchema), {
        id: 'editLabelForm'
    });
    editLabelForm.data.bg_color = '#dee2ed';
    editLabelForm.data.txt_color = '#000000';

    const newLabelForm = await superValidate(zod(labelsSchema), {
        id: 'newLabelForm'
    });
    newLabelForm.data.bg_color = '#dee2ed';
    newLabelForm.data.txt_color = '#000000';

    const deleteLabelForm = await superValidate(zod(labelsSchema), {
        id: 'deleteLabelForm'
    });
    
    let { data: labels, error } = await supabase
    .from('labels')
    .select('*')
    .order('order', { ascending: true });

    return { newLabelForm, editLabelForm, deleteLabelForm, labels: labels || []};
}) satisfies PageServerLoad;

// Form actions
export const actions: Actions = {
    createLabel: async ({ request, locals: { supabase, safeGetSession } }) => {
        const newLabelForm = await superValidate(request, zod(labelsSchema));

        if (!newLabelForm.valid) {
            return fail(400, { newLabelForm });
        }

        let { data: labelsData, error: labelsError } = await supabase
        .from('labels')
        .select('order')

        if (labelsError) {
            return fail(400, { newLabelForm });
        }

        if (!labelsData) {
            labelsData = [];
        }

        let maxOrder = 0;

        for ( const label of labelsData ) {
            if (label.order > maxOrder) {
                maxOrder = label.order;
            }
        }

        const { } = await supabase
            .from('labels')
            .insert([
            { 
                order: maxOrder + 1, 
                label_name: newLabelForm.data.label_name.trim(), 
                bg_color: newLabelForm.data.bg_color, 
                txt_color: newLabelForm.data.txt_color},
            ])
    },
    updateLabel: async ({ request, locals: { supabase, safeGetSession } }) => {
        const editLabelForm = await superValidate(request, zod(labelsSchema));

        if (!editLabelForm.valid) {
            return fail(400, { editLabelForm });
        }
        
        const { } = await supabase
            .from('labels')
            .update({
                label_name: editLabelForm.data.label_name.trim(), 
                bg_color: editLabelForm.data.bg_color, 
                txt_color: editLabelForm.data.txt_color })
            .eq('id', editLabelForm.data.id)
    },
    deleteLabel: async ({ request, locals: { supabase, safeGetSession } }) => {
        const deleteLabelForm = await superValidate(request, zod(labelsSchema));

        if (!deleteLabelForm.valid) {
            return fail(400, { deleteLabelForm });
        }
        
        const { } = await supabase
            .from('labels')
            .delete()
            .eq('id', deleteLabelForm.data.id)
    },
};
