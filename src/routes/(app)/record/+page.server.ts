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
    updatePatientNote: async ({ request , locals: { supabase, safeGetSession } }) => {
        let form = await request.formData();

        const patient_id = form.get('patient_id');
        const note = form.get('note');

        const { data, error } = await supabase
        .from('patients')
        .update({ note: note })
        .eq( 'id', patient_id )

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
    updateDenial: async ({ request , locals: { supabase, safeGetSession } }) => {
        const form = await request.formData();

        const denial_id = form.get('denial_id');
        const service_start_date = form.get('service_start_date');
        let service_end_date = form.get('service_end_date');
        const billed_amount = form.get('billed_amount');
        const paid_amount = form.get('paid_amount');
        let label_ids = [];

        if (service_end_date === '') {
            service_end_date = null;
        }

        for (let [name, value] of form.entries()) {
            if (name === 'label_id') {
                label_ids.push(value);
            }
        }

        const { } = await supabase
        .from('denials')
        .update({ 
            service_start_date: service_start_date,
            service_end_date: service_end_date,
            billed_amount: billed_amount,
            paid_amount: paid_amount
         })
        .eq( 'id', denial_id )

        const { } = await supabase
        .from('denial_labels')
        .delete()
        .eq( 'denial_id', denial_id )        

        for (const label_id of label_ids) {
            const { } = await supabase
                .from('denial_labels')
                .insert([
                { denial_id: denial_id, label_id: label_id },
                ])
        }
    },
    deleteDenial: async ({ request , locals: { supabase, safeGetSession } }) => {
        const form = await request.formData();

        const { } = await supabase
        .from('denials')
        .delete()
        .eq('id', form.get('denial_id'))    
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
                denial_id: newNoteForm.data.denial_id,
                created_by: sessionData.user.id,
                note: newNoteForm.data.note,
            },
        ])
        .select()

        return { newNoteForm };
    },
    updateNote: async ({ request , locals: { supabase, safeGetSession } }) => {
        const sessionData = await safeGetSession();
        const form = await request.formData();

        const note_id = form.get('note_id');
        const modified_at = new Date();
        const modified_by = sessionData.user.id;
        const note = form.get('note');

        const { data, error } = await supabase
        .from('notes')
        .update({ 
            modified_at: modified_at,
            modified_by: modified_by,
            note: note
         })
        .eq( 'id', note_id )
    },
    deleteNote: async ({ request , locals: { supabase, safeGetSession } }) => {
        const form = await request.formData();

        const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', form.get('note_id'))
        
    },
}
