import { superValidate, fail } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { openAIClient, openAIModel } from '$lib/openAIClient';
import { formatDate } from '$lib/utils';

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
    is_closed: z.boolean().optional(),
    insurance_id: z.array(z.number()).optional(),
    label_id: z.array(z.number()),
    note: z.string()
});

const schemaNewNote = z.object({
    denial_id: z.number(),
    attachmentList: z.array(z.string()),
    note: z.string(),
});

export const load = async ({ parent, locals: { supabase, safeGetSession } }) => {	
    await parent();
    const newPatientForm = await superValidate(zod(schemaNewPatient));

    const newDenialForm = await superValidate(zod(schemaNewDenial));
    newDenialForm.data.billed_amount = 0;
    newDenialForm.data.paid_amount = 0;

    const newNoteForm = await superValidate(zod(schemaNewNote));
    
    let { data: patients, error: errorPatients } = await supabase
        .from('patients')
        .select('*, patients_files(file_name)')
        .order('last_name', { ascending: true })

    let { data: insurances, error: errorInsurances } = await supabase
        .from('insurances')
        .select('*')
        .order('name', { ascending: true })

    let { data: labels, error: errorLabels } = await supabase
        .from('labels')
        .select('*')
        .order('order', { ascending: true })
    
    return { newPatientForm, newDenialForm, newNoteForm, patients: patients || [], insurances: insurances || [], labels: labels || []}
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
        const sessionData = await safeGetSession();
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
                    paid_amount: newDenialForm.data.paid_amount,
                    is_closed: newDenialForm.data.is_closed || false,
                },
            ])
            .select('id')

        if (denialsError) {
            return fail(400, { newDenialForm });
        }

        if (newDenialForm.data.insurance_id != undefined) {
            for (const insurance_id of newDenialForm.data.insurance_id) {
                const { } = await supabase
                    .from('denials_insurances')
                    .insert([
                    { denial_id: denials[0].id, insurance_id: insurance_id },
                    ])
            }
        }        

        for (const label_id of newDenialForm.data.label_id) {
            const { } = await supabase
                .from('denials_labels')
                .insert([
                { denial_id: denials[0].id, label_id: label_id },
                ])
        }

        const { data: insertedNote, error } = await supabase
            .from('notes')
            .insert([
                {
                    denial_id: denials[0].id,
                    created_by: sessionData.user.id,
                    note: newDenialForm.data.note,
                },
            ])
            .select('id')
            .single();
        
        return { newDenialForm };
    },
    updateDenial: async ({ request , locals: { supabase, safeGetSession } }) => {
        const form = await request.formData();

        const denial_id = form.get('denial_id');
        const service_start_date = form.get('service_start_date');
        let service_end_date = form.get('service_end_date');
        const billed_amount = form.get('billed_amount');
        const paid_amount = form.get('paid_amount');
        const is_closed = form.get('is_closed') === 'on' ? true : false;
        let insurance_ids = form.getAll('insurances');
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
            paid_amount: paid_amount,
            is_closed: is_closed,
         })
        .eq( 'id', denial_id )

        const { } = await supabase
            .from('denials_insurances')
            .delete()
            .eq( 'denial_id', denial_id )

        for (const insurance_id of insurance_ids) {
            const { } = await supabase
                .from('denials_insurances')
                .insert([
                { denial_id: denial_id, insurance_id: insurance_id },
                ])
        }

        const { } = await supabase
            .from('denials_labels')
            .delete()
            .eq( 'denial_id', denial_id )        

        for (const label_id of label_ids) {
            const { } = await supabase
                .from('denials_labels')
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
        
        const { data: insertedNote, error } = await supabase
        .from('notes')
        .insert([
            {
                denial_id: newNoteForm.data.denial_id,
                created_by: sessionData.user.id,
                note: newNoteForm.data.note,
            },
        ])
        .select('id')
        .single();

        if (error) {
            return fail(400, { newNoteForm });
        }

        const attachmentList = newNoteForm.data.attachmentList[0].split(',');

        for (const name of attachmentList) {
            const {error} = await supabase
                .from('notes_files')
                .insert([
                    {
                        note_id: insertedNote.id,
                        file_name: name,
                    },
                ]);
        }  

        return { newNoteForm };
    },
    updateNote: async ({ request , locals: { supabase, safeGetSession } }) => {
        const sessionData = await safeGetSession();
        const form = await request.formData();

        const note_id = form.get('note_id');
        const modified_at = new Date();
        const modified_by = sessionData.user.id;
        const note = form.get('note');

        const {data: attachmentListOriginalObject} = await supabase
            .from('notes_files')
            .select('file_name')
            .eq('note_id', note_id);

        let attachmentListOriginal: string[] = [];
        if (attachmentListOriginalObject) {
            attachmentListOriginal = attachmentListOriginalObject.map((attachment) => attachment.file_name);
            console.log(attachmentListOriginal);
        }

        const attachmentStrings = String(form.get('attachmentList'));
        let attachmentList: string[] = [];

        if (attachmentStrings) {
            attachmentList = attachmentStrings.split(',');
            console.log(attachmentList);
        }

        const attachmentListToAdd = attachmentList.filter((name) => !attachmentListOriginal.includes(name));
        const attachmentListToDelete = attachmentListOriginal.filter((name) => !attachmentList.includes(name));

        console.log("attachmentListToAdd", attachmentListToAdd);
        console.log("attachmentListToDelete", attachmentListToDelete);

        for (const name of attachmentListToAdd) {
            const {error} = await supabase
                .from('notes_files')
                .insert([
                    {
                        note_id: note_id,
                        file_name: name,
                    },
                ]);
        }

        for (const name of attachmentListToDelete) {
            const {error} = await supabase
                .from('notes_files')
                .delete()
                .eq('note_id', note_id)
                .eq('file_name', name);
        }

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
    getFileList: async ({ request, locals: { supabase, safeGetSession } }) => {

        const form = await request.formData();
        const date = form.get('date');

        if (!date) {
            return { fileList: [] };
        }
        
        const folderPath = date.toString().replace(/-/g, '/');

        const { data, error } = await supabase
            .from('files')
            .select('name, created_at, size, metadata')
            .like('name', `%${folderPath}%`)
            .order('created_at', { ascending: true });

        if (error) {
            return { fileList: [] };
        }

        let fileList = data;

        return { fileList, folderPath };

    },
    uploadNewFile: async ({ request, locals: { supabase, safeGetSession } }) => {

        const form = await request.formData();
        const files = form.getAll('files') as File[];
        const patientID = form.get('patient_id');
        
        for (const file of files) {
            const { data, error } = await supabase
                .storage
                .from('files')
                .upload(`patients/${patientID}/${file.name}`, file);

            if (error) {
                return { };
            }
            else {

            const { } = await supabase
                .from('patients_files')
                .insert([
                    {
                        patient_id: patientID,
                        file_name: `patients/${patientID}/${file.name}`,
                    },
                ]);

                const { } = await supabase
                .from('files')
                .insert({ 
                    name: `patients/${patientID}/${file.name}`, 
                    size: file.size, 
                    mimetype: file.type, 
                    metadata: { status: 'New', note: '' } 
                });
            }
        }        
        
        return { };
    },
    generateDenialSummary: async ({ request , locals: { supabase, safeGetSession } }) => {
        const form = await request.formData();
        const denial_id = form.get('denial_id');
        let responseText = '';

        let { data: denials, error: denialsError } = await supabase
            .from('denials')
            .select(`id, created_at, service_start_date, service_end_date, billed_amount, paid_amount, is_closed,
                notes(id, denial_id, created_at, modified_at, created_by:created_by(username), modified_by:modified_by(username), note), 
                patients(id, created_at, last_name, first_name, date_of_birth, note),
                insurances(*)`)     
            .eq('id', denial_id)
            .order('created_at', { referencedTable: 'notes', ascending: true })
            .single();

        if (denialsError) {
            return { responseText: `Error fetching denial data: ${denialsError.message}` };
        }

        let prompt = `
            You are an expert in summarizing. Your task is to summarize the denials events below.

            ### Summary Format:
            [Short Summary]
            [Chronological List of Events]

            ### Detailed Instructions:
            1. Write a clear Short Summary.
            2. Include the latest status of the denial at the end of the short summary.
            3. Use bullet points for Chronological List of Events.
            4. Use MM/DD/YYYY format for dates.
            5. Do not use tables.
            6. Do not write Short Summary heading.

            ### Claim Information:
            - Claim Date of Service: ${formatDate(denials.service_start_date)}${denials.service_end_date ? ' to ' + formatDate(denials.service_end_date) : ''}
            - Insurances Involved: ${denials.insurances.map(ins => ins.name).join(', ')}
            - Additional Patient Info: ${denials.patients.note || 'N/A'}

            ### Denials Events:
            `;

        for (const note of denials.notes) {
            prompt += `(${formatDate(note.created_at)}): ${note.note}\n`;
        }

        try {
			let response = await openAIClient.chat.completions.create({
				model: openAIModel,
				messages: [{ role: 'user', content: prompt }]
			});
            
            responseText = response.choices[0].message.content || 'No response generated.';
		} catch (error) {
			console.error('Error fetching response from OpenAI:', error);
			return `Error: ${error.message}`;
		}

        return { responseText };
    },
}
