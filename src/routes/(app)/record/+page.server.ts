import { superValidate, fail } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';

const schemaNewPatient = z.object({
    last_name: z.string(),
    first_name: z.string(),
    date_of_birth: z.date(),
});

const schemaNewDenial = z.object({
    patient_id: z.number(),
    service_start_date: z.date(),
    service_end_date: z.date().optional(),
    billed_amount: z.number().nonnegative(),
    paid_amount: z.number().nonnegative(),
    label_id: z.array(z.number()),
});

const schemaNewNote = z.object({
    denial_id: z.number(),
    note: z.string(),
});

export const load = async ({ request, locals: { supabase, safeGetSession } }) => {	
    const newPatientForm = await superValidate(zod(schemaNewPatient));

    const newDenialForm = await superValidate(zod(schemaNewDenial));
    newDenialForm.data.billed_amount = 0;
    newDenialForm.data.paid_amount = 0;

    const newNoteForm = await superValidate(zod(schemaNewNote));
    
    let { data: patients, error: errorPatients } = await supabase
    .from('patients')
    .select('*')
    .order('last_name', { ascending: true })

    let { data: labels, error: errorLabels } = await supabase
    .from('labels')
    .select('*')
    .order('order', { ascending: true })
    
    return { newPatientForm, newDenialForm, newNoteForm, patients: patients || [], labels: labels || []}
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
    },
    createDenial: async ({ request, locals: { supabase, safeGetSession } }) => {
        const newDenialForm = await superValidate(request, zod(schemaNewDenial));        

        if (!newDenialForm.valid) {
            return fail(400, { newDenialForm });
        }

        const { data: denials, error: denialsError } = await supabase
            .from('denials')
            .insert([
                {
                    patient_id: newDenialForm.data.patient_id,
                    service_start_date: newDenialForm.data.service_start_date,
                    service_end_date: newDenialForm.data.service_end_date,
                    billed_amount: newDenialForm.data.billed_amount,
                    paid_amount: newDenialForm.data.paid_amount
                },
            ])
            .select('id')

        if (denialsError) {
            return fail(400, { newDenialForm });
        }

        for (const label_id of newDenialForm.data.label_id) {
            const { } = await supabase
                .from('denial_labels')
                .insert([
                { denial_id: denials[0].id, label_id: label_id },
                ])
        }
        
        return { newDenialForm };
    },
    createNote: async ({ request, locals: { supabase, safeGetSession } }) => {
        const sessionData = await safeGetSession();

        const newNoteForm = await superValidate(request, zod(schemaNewNote));        

        if (!newNoteForm.valid) {
            return fail(400, { newNoteForm });
        }
        
        const { data: insertedNote } = await supabase
        .from('notes')
        .insert([
            {
                user_id: sessionData.user.id,
                note: newNoteForm.data.note,
            },
        ])
        .select()

        if (insertedNote) {
            const { data, error} = await supabase
            .from('denial_notes')
            .insert([
                {
                    denial_id: newNoteForm.data.denial_id,
                    note_id: insertedNote[0].id
                },
            ])
        }        

        return { newNoteForm };
    },
}
