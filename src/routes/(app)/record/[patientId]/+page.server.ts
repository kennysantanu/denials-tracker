import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Database } from '$lib/supabase';
import { getPatientById } from '$lib/server/db/patients';
import {
	getDenialsByPatient,
	createDenial,
	updateDenial,
	deleteDenial
} from '$lib/server/db/denials';
import { createNote, deleteNote, updateNote } from '$lib/server/db/notes';
import { getInsurances, updateInsurance } from '$lib/server/db/insurances';
import { getLabels } from '$lib/server/db/labels';
import { uploadFile } from '$lib/server/db/files';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, params, parent, request }) => {
	const user = await locals.getUser();
	if (!user) {
		redirect(303, '/signin');
	}

	const patientId = parseInt(params.patientId, 10);
	if (isNaN(patientId)) {
		error(400, 'Invalid patient ID');
	}

	const supabase = locals.supabase;

	const [patientResult, denialsResult, insurancesResult, labelsResult] = await Promise.all([
		getPatientById(supabase, patientId),
		getDenialsByPatient(supabase, patientId),
		getInsurances(supabase),
		getLabels(supabase)
	]);

	if (patientResult.error || !patientResult.data) {
		error(404, 'Patient not found');
	}

	const patient = patientResult.data;
	const denials = denialsResult.data ?? [];
	const allInsurances = insurancesResult.data ?? [];
	const allLabels = labelsResult.data ?? [];

	// Fetch junction data and notes for all denials at once
	const denialIds = denials.map((d) => d.id);

	let denialInsurances: { denial_id: number; insurance_id: number }[] = [];
	let denialLabels: { denial_id: number; label_id: number }[] = [];
	let allNotes: Database['public']['Tables']['notes']['Row'][] = [];

	if (denialIds.length > 0) {
		const [insResult, lblResult, notesResult] = await Promise.all([
			supabase
				.from('denials_insurances')
				.select('denial_id, insurance_id')
				.in('denial_id', denialIds),
			supabase.from('denials_labels').select('denial_id, label_id').in('denial_id', denialIds),
			supabase
				.from('notes')
				.select(
					'*, created_by_user:users!public_notes_created_by_fkey(username), notes_files(file_name, files!notes_files_file_name_fkey(name, size, mimetype, created_at))'
				)
				.in('denial_id', denialIds)
				.order('created_at', { ascending: false })
		]);

		denialInsurances = insResult.data ?? [];
		denialLabels = lblResult.data ?? [];
		allNotes = notesResult.data ?? [];
	}

	// Group notes by denial_id
	const notesByDenial = new Map<number, typeof allNotes>();
	for (const note of allNotes) {
		const list = notesByDenial.get(note.denial_id) ?? [];
		list.push(note);
		notesByDenial.set(note.denial_id, list);
	}

	// Merge relations onto each denial
	const denialsWithRelations = denials.map((denial) => {
		const insIds = denialInsurances
			.filter((di) => di.denial_id === denial.id)
			.map((di) => di.insurance_id);
		const lblIds = denialLabels.filter((dl) => dl.denial_id === denial.id).map((dl) => dl.label_id);

		return {
			...denial,
			insurances: allInsurances.filter((ins) => insIds.includes(ins.id)),
			labels: allLabels.filter((lbl) => lblIds.includes(lbl.id)),
			notes: notesByDenial.get(denial.id) ?? []
		};
	});

	const { permissions } = await parent();

	logAudit(supabase, user.id, 'view', 'patient', String(patientId), undefined, request);

	return {
		patient,
		denials: denialsWithRelations,
		allInsurances,
		allLabels,
		permissions
	};
};

export const actions: Actions = {
	createDenial: async ({ locals, params, request }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const patientId = parseInt(params.patientId, 10);
		if (isNaN(patientId)) return fail(400, { error: 'Invalid patient ID' });

		const formData = await request.formData();
		const serviceStartDate = formData.get('service_start_date') as string;
		if (!serviceStartDate) {
			return fail(400, { error: 'Service start date is required' });
		}

		const serviceEndDate = (formData.get('service_end_date') as string) || null;
		const billedAmount = formData.get('billed_amount')
			? parseFloat(formData.get('billed_amount') as string)
			: null;
		const paidAmount = formData.get('paid_amount')
			? parseFloat(formData.get('paid_amount') as string)
			: null;
		const followUpDate = (formData.get('follow_up_date') as string) || null;

		const insuranceIds = formData
			.getAll('insurance_ids')
			.map(Number)
			.filter((n) => !isNaN(n));
		const labelIds = formData
			.getAll('label_ids')
			.map(Number)
			.filter((n) => !isNaN(n));

		const { data: denial, error: createError } = await createDenial(
			locals.supabase,
			{
				patient_id: patientId,
				service_start_date: serviceStartDate,
				service_end_date: serviceEndDate,
				billed_amount: billedAmount,
				paid_amount: paidAmount,
				follow_up_date: followUpDate
			},
			insuranceIds.length ? insuranceIds : undefined,
			labelIds.length ? labelIds : undefined
		);

		if (createError || !denial) {
			return fail(400, { error: createError?.message ?? 'Failed to create denial' });
		}

		logAudit(locals.supabase, user.id, 'create', 'denial', String(denial.id), undefined, request);

		return { success: true };
	},

	updateDenial: async ({ locals, params, request }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const formData = await request.formData();
		const denialId = parseInt(formData.get('id') as string, 10);
		if (isNaN(denialId)) return fail(400, { error: 'Invalid denial ID' });

		const serviceStartDate = formData.get('service_start_date') as string;
		if (!serviceStartDate) {
			return fail(400, { error: 'Service start date is required' });
		}

		const serviceEndDate = (formData.get('service_end_date') as string) || null;
		const billedAmount = formData.get('billed_amount')
			? parseFloat(formData.get('billed_amount') as string)
			: null;
		const paidAmount = formData.get('paid_amount')
			? parseFloat(formData.get('paid_amount') as string)
			: null;
		const followUpDate = (formData.get('follow_up_date') as string) || null;
		const isClosed = formData.get('is_closed') === 'true';

		const insuranceIds = formData
			.getAll('insurance_ids')
			.map(Number)
			.filter((n) => !isNaN(n));
		const labelIds = formData
			.getAll('label_ids')
			.map(Number)
			.filter((n) => !isNaN(n));

		const { error: updateError } = await updateDenial(
			locals.supabase,
			denialId,
			{
				service_start_date: serviceStartDate,
				service_end_date: serviceEndDate,
				billed_amount: billedAmount,
				paid_amount: paidAmount,
				follow_up_date: followUpDate,
				is_closed: isClosed
			},
			insuranceIds,
			labelIds
		);

		if (updateError) {
			return fail(400, { error: updateError.message });
		}

		logAudit(locals.supabase, user.id, 'update', 'denial', String(denialId), undefined, request);

		return { success: true };
	},

	deleteDenial: async ({ locals, request }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const formData = await request.formData();
		const denialId = parseInt(formData.get('id') as string, 10);
		if (isNaN(denialId)) return fail(400, { error: 'Invalid denial ID' });

		const { error: deleteError } = await deleteDenial(locals.supabase, denialId);

		if (deleteError) {
			return fail(400, { error: deleteError.message });
		}

		logAudit(locals.supabase, user.id, 'delete', 'denial', String(denialId), undefined, request);

		return { success: true };
	},

	createNote: async ({ locals, params, request }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const patientId = parseInt(params.patientId, 10);
		if (isNaN(patientId)) return fail(400, { error: 'Invalid patient ID' });

		const formData = await request.formData();
		const noteText = (formData.get('note') as string)?.trim();
		const denialId = parseInt(formData.get('denial_id') as string, 10);
		const files = formData.getAll('files') as File[];
		const existingFileNames = formData.getAll('existing_files').map(String).filter(Boolean);

		if (!noteText) return fail(400, { error: 'Note text is required' });
		if (isNaN(denialId)) return fail(400, { error: 'Invalid denial ID' });

		const supabase = locals.supabase;
		const uploadedFilePaths: string[] = [];

		try {
			// Upload files to storage
			for (const file of files) {
				if (!file.size || !file.name) continue;

				const timestamp = Date.now();
				const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
				const storagePath = `${patientId}/${timestamp}_${safeName}`;

				const { error: uploadError } = await uploadFile(supabase, storagePath, file, {
					contentType: file.type
				});

				if (uploadError) {
					throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
				}

				uploadedFilePaths.push(storagePath);

				// Insert into files table
				const { error: fileDbError } = await supabase.from('files').insert({
					name: storagePath,
					size: file.size,
					mimetype: file.type || null
				});

				if (fileDbError) {
					throw new Error(`Failed to save file record: ${fileDbError.message}`);
				}

				// Insert patients_files junction
				await supabase.from('patients_files').insert({
					patient_id: patientId,
					file_name: storagePath
				});
			}

			// Create the note
			const { data: note, error: noteError } = await createNote(supabase, {
				note: noteText,
				denial_id: denialId,
				created_by: user.id
			});

			if (noteError || !note) {
				throw new Error(noteError?.message ?? 'Failed to create note');
			}

			// Link uploaded files to note via notes_files junction
			for (const filePath of uploadedFilePaths) {
				await supabase.from('notes_files').insert({
					note_id: note.id,
					file_name: filePath
				});
			}

			// Link existing files to note via notes_files junction
			for (const fileName of existingFileNames) {
				// Verify the file exists before linking
				const { data: existingFile } = await supabase
					.from('files')
					.select('name')
					.eq('name', fileName)
					.single();
				if (existingFile) {
					await supabase.from('notes_files').insert({
						note_id: note.id,
						file_name: fileName
					});
				}
			}

			logAudit(supabase, user.id, 'create', 'note', String(note.id), { denialId }, request);

			return { success: true };
		} catch (err) {
			// Clean up uploaded files on failure
			if (uploadedFilePaths.length > 0) {
				await supabase.storage.from('files').remove(uploadedFilePaths);
				for (const fp of uploadedFilePaths) {
					await supabase.from('files').delete().eq('name', fp);
					await supabase.from('patients_files').delete().eq('file_name', fp);
				}
			}

			const message = err instanceof Error ? err.message : 'Failed to create note';
			return fail(400, { error: message });
		}
	},

	deleteNote: async ({ locals, request }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const formData = await request.formData();
		const noteId = parseInt(formData.get('id') as string, 10);
		if (isNaN(noteId)) return fail(400, { error: 'Invalid note ID' });

		const { error: deleteError } = await deleteNote(locals.supabase, noteId);

		if (deleteError) {
			return fail(400, { error: deleteError.message });
		}

		logAudit(locals.supabase, user.id, 'delete', 'note', String(noteId), undefined, request);

		return { success: true };
	},

	updateNote: async ({ locals, request }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const formData = await request.formData();
		const noteId = parseInt(formData.get('id') as string, 10);
		const noteText = (formData.get('note') as string)?.trim();
		const addFiles = formData
			.getAll('add_files')
			.map((v) => v.toString())
			.filter(Boolean);
		const removeFiles = formData
			.getAll('remove_files')
			.map((v) => v.toString())
			.filter(Boolean);

		if (isNaN(noteId)) return fail(400, { error: 'Invalid note ID' });
		if (!noteText) return fail(400, { error: 'Note text is required' });

		const supabase = locals.supabase;

		const { error: updateError } = await updateNote(supabase, noteId, {
			note: noteText,
			modified_by: user.id
		});

		if (updateError) {
			return fail(400, { error: updateError.message });
		}

		// Remove file associations
		if (removeFiles.length > 0) {
			for (const fileName of removeFiles) {
				await supabase.from('notes_files').delete().eq('note_id', noteId).eq('file_name', fileName);
			}
		}

		// Add new file associations
		if (addFiles.length > 0) {
			const rows = addFiles.map((fileName) => ({ note_id: noteId, file_name: fileName }));
			await supabase.from('notes_files').upsert(rows, { onConflict: 'note_id,file_name' });
		}

		logAudit(locals.supabase, user.id, 'update', 'note', String(noteId), undefined, request);

		return { success: true };
	},

	updateInsuranceNote: async ({ locals, request }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const formData = await request.formData();
		const insuranceId = parseInt(formData.get('id') as string, 10);
		const noteText = (formData.get('note') as string)?.trim() || null;

		if (isNaN(insuranceId)) return fail(400, { error: 'Invalid insurance ID' });

		const { error: updateError } = await updateInsurance(locals.supabase, insuranceId, {
			note: noteText
		});

		if (updateError) {
			return fail(400, { error: updateError.message });
		}

		logAudit(
			locals.supabase,
			user.id,
			'update',
			'insurance',
			String(insuranceId),
			undefined,
			request
		);

		return { success: true };
	}
};
