import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Database } from '$lib/supabase';
import { getPatientById, updatePatient } from '$lib/server/db/patients';
import {
	getDenialsByPatient,
	createDenial,
	updateDenial,
	deleteDenial
} from '$lib/server/db/denials';
import { createNote, deleteNote, updateNote } from '$lib/server/db/notes';
import { getInsurances, updateInsurance } from '$lib/server/db/insurances';
import { getLabels } from '$lib/server/db/labels';
import {
	getPatientFilePath,
	getPatientLinkedFileNames,
	uploadFile,
	getVersionedPath
} from '$lib/server/db/files';
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

	const [patientResult, denialsResult, insurancesResult, labelsResult, patientFilesResult] =
		await Promise.all([
			getPatientById(supabase, patientId),
			getDenialsByPatient(supabase, patientId),
			getInsurances(supabase),
			getLabels(supabase),
			supabase
				.from('patients_files')
				.select('file_name, created_at')
				.eq('patient_id', patientId)
				.order('created_at', { ascending: false })
		]);

	if (patientResult.error || !patientResult.data) {
		error(404, 'Patient not found');
	}

	const patient = patientResult.data;
	const denials = denialsResult.data ?? [];
	const allInsurances = insurancesResult.data ?? [];
	const allLabels = labelsResult.data ?? [];

	// Fetch file details for patient files
	const pfRows = patientFilesResult.data ?? [];
	let patientFiles: {
		name: string;
		size: number | null;
		mimetype: string | null;
		created_at: string;
	}[] = [];
	if (pfRows.length > 0) {
		const fileNames = pfRows.map((pf) => pf.file_name);
		const { data: filesData } = await supabase
			.from('files')
			.select('name, size, mimetype, created_at')
			.in('name', fileNames);

		const filesMap = new Map((filesData ?? []).map((f) => [f.name, f]));
		patientFiles = pfRows.map((pf) => {
			const f = filesMap.get(pf.file_name);
			return {
				name: pf.file_name,
				size: f?.size ?? null,
				mimetype: f?.mimetype ?? null,
				created_at: pf.created_at
			};
		});
	}

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
		permissions,
		patientFiles
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
		const initialNote = (formData.get('initial_note') as string)?.trim();
		if (!initialNote) {
			return fail(400, { error: 'Note is required' });
		}

		const files = formData.getAll('files') as File[];
		const existingFileNames = formData.getAll('existing_files').map(String).filter(Boolean);
		const patientLinkedFilesResult = await getPatientLinkedFileNames(
			locals.supabase,
			existingFileNames
		);

		if (patientLinkedFilesResult.error) {
			return fail(400, { error: patientLinkedFilesResult.error.message });
		}

		if (patientLinkedFilesResult.data.length > 0) {
			return fail(400, {
				error: 'Patient attachments can only be managed from the patient record header.'
			});
		}

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
		const supabase = locals.supabase;
		const uploadedFilePaths: string[] = [];

		try {
			// Upload new files to storage
			for (const file of files) {
				if (!file.size || !file.name) continue;

				const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
				const now = new Date();
				const dateFolder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
				const storagePath = await getVersionedPath(supabase, dateFolder, safeName);

				const { error: uploadError } = await uploadFile(supabase, storagePath, file, {
					contentType: file.type
				});

				if (uploadError) {
					throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
				}

				uploadedFilePaths.push(storagePath);

				const { error: fileDbError } = await supabase.from('files').insert({
					name: storagePath,
					size: file.size,
					mimetype: file.type || null
				});

				if (fileDbError) {
					throw new Error(`Failed to save file record: ${fileDbError.message}`);
				}
			}

			// Create the initial note
			const { data: note, error: noteError } = await createNote(supabase, {
				denial_id: denial.id,
				note: initialNote,
				created_by: user.id
			});

			if (noteError || !note) {
				throw new Error(noteError?.message ?? 'Failed to create note');
			}

			// Link uploaded files to note
			for (const filePath of uploadedFilePaths) {
				await supabase.from('notes_files').insert({
					note_id: note.id,
					file_name: filePath
				});
			}

			// Link existing files to note
			for (const fileName of existingFileNames) {
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
		} catch (err) {
			// Clean up uploaded files on failure
			if (uploadedFilePaths.length > 0) {
				await supabase.storage.from('files').remove(uploadedFilePaths);
				for (const fp of uploadedFilePaths) {
					await supabase.from('files').delete().eq('name', fp);
				}
			}
			const message = err instanceof Error ? err.message : 'Failed to save attachments';
			return fail(400, { error: message });
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
		const patientLinkedFilesResult = await getPatientLinkedFileNames(
			locals.supabase,
			existingFileNames
		);

		if (patientLinkedFilesResult.error) {
			return fail(400, { error: patientLinkedFilesResult.error.message });
		}

		if (patientLinkedFilesResult.data.length > 0) {
			return fail(400, {
				error: 'Patient attachments can only be managed from the patient record header.'
			});
		}

		if (!noteText) return fail(400, { error: 'Note text is required' });
		if (isNaN(denialId)) return fail(400, { error: 'Invalid denial ID' });

		const supabase = locals.supabase;
		const uploadedFilePaths: string[] = [];

		try {
			// Upload files to storage
			for (const file of files) {
				if (!file.size || !file.name) continue;

				const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
				const now = new Date();
				const dateFolder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
				const storagePath = await getVersionedPath(supabase, dateFolder, safeName);

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
		const patientId = parseInt(formData.get('patient_id') as string, 10);
		const noteText = (formData.get('note') as string)?.trim();
		const newFiles = formData.getAll('files') as File[];
		const addFiles = formData
			.getAll('add_files')
			.map((v) => v.toString())
			.filter(Boolean);
		const existingFiles = formData
			.getAll('existing_files')
			.map((v) => v.toString())
			.filter(Boolean);
		const removeFiles = formData
			.getAll('remove_files')
			.map((v) => v.toString())
			.filter(Boolean);
		const filesToAssociate = [...addFiles, ...existingFiles];
		const patientLinkedFilesResult = await getPatientLinkedFileNames(
			locals.supabase,
			filesToAssociate
		);

		if (patientLinkedFilesResult.error) {
			return fail(400, { error: patientLinkedFilesResult.error.message });
		}

		if (patientLinkedFilesResult.data.length > 0) {
			return fail(400, {
				error: 'Patient attachments can only be managed from the patient record header.'
			});
		}

		if (isNaN(noteId)) return fail(400, { error: 'Invalid note ID' });
		if (!noteText) return fail(400, { error: 'Note text is required' });

		const supabase = locals.supabase;
		const uploadedFilePaths: string[] = [];

		try {
			const { error: updateError } = await updateNote(supabase, noteId, {
				note: noteText,
				modified_by: user.id
			});

			if (updateError) {
				return fail(400, { error: updateError.message });
			}

			// Upload new files to storage
			for (const file of newFiles) {
				if (!file.size || !file.name) continue;

				const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
				const now = new Date();
				const dateFolder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
				const storagePath = await getVersionedPath(supabase, dateFolder, safeName);

				const { error: uploadError } = await uploadFile(supabase, storagePath, file, {
					contentType: file.type
				});

				if (uploadError) {
					throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
				}

				uploadedFilePaths.push(storagePath);

				const { error: fileDbError } = await supabase.from('files').insert({
					name: storagePath,
					size: file.size,
					mimetype: file.type || null
				});

				if (fileDbError) {
					throw new Error(`Failed to save file record: ${fileDbError.message}`);
				}

				await supabase.from('notes_files').insert({
					note_id: noteId,
					file_name: storagePath
				});
			}

			// Remove file associations
			if (removeFiles.length > 0) {
				for (const fileName of removeFiles) {
					await supabase
						.from('notes_files')
						.delete()
						.eq('note_id', noteId)
						.eq('file_name', fileName);
				}
			}

			// Associate existing files (add_files from edit mode, existing_files from notes with no prior attachments)
			if (filesToAssociate.length > 0) {
				const rows = filesToAssociate.map((fileName) => ({ note_id: noteId, file_name: fileName }));
				await supabase.from('notes_files').upsert(rows, { onConflict: 'note_id,file_name' });
			}

			logAudit(locals.supabase, user.id, 'update', 'note', String(noteId), undefined, request);

			return { success: true };
		} catch (err) {
			// Clean up uploaded files on failure
			if (uploadedFilePaths.length > 0) {
				await supabase.storage.from('files').remove(uploadedFilePaths);
				for (const fp of uploadedFilePaths) {
					await supabase.from('files').delete().eq('name', fp);
				}
			}

			const message = err instanceof Error ? err.message : 'Failed to update note';
			return fail(400, { error: message });
		}
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
	},

	uploadPatientFile: async ({ locals, params, request }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const patientId = parseInt(params.patientId, 10);
		if (isNaN(patientId)) return fail(400, { error: 'Invalid patient ID' });

		const formData = await request.formData();
		const files = formData.getAll('files') as File[];

		if (!files.length || !files[0].size) {
			return fail(400, { error: 'No files selected' });
		}

		const supabase = locals.supabase;
		const uploadedFilePaths: string[] = [];

		try {
			for (const file of files) {
				if (!file.size || !file.name) continue;

				const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
				const storagePath = await getPatientFilePath(supabase, patientId, safeName);

				const { error: uploadError } = await uploadFile(supabase, storagePath, file, {
					contentType: file.type
				});

				if (uploadError) {
					throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
				}

				uploadedFilePaths.push(storagePath);

				const { error: fileDbError } = await supabase.from('files').insert({
					name: storagePath,
					size: file.size,
					mimetype: file.type || null
				});

				if (fileDbError) {
					throw new Error(`Failed to save file record: ${fileDbError.message}`);
				}

				await supabase.from('patients_files').insert({
					patient_id: patientId,
					file_name: storagePath
				});
			}

			logAudit(
				supabase,
				user.id,
				'upload',
				'patient_file',
				String(patientId),
				{ fileCount: uploadedFilePaths.length },
				request
			);

			return { success: true };
		} catch (err) {
			// Clean up on failure
			if (uploadedFilePaths.length > 0) {
				await supabase.storage.from('files').remove(uploadedFilePaths);
				for (const fp of uploadedFilePaths) {
					await supabase.from('files').delete().eq('name', fp);
					await supabase.from('patients_files').delete().eq('file_name', fp);
				}
			}
			const message = err instanceof Error ? err.message : 'Failed to upload files';
			return fail(400, { error: message });
		}
	},

	removePatientFile: async ({ locals, params, request }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const patientId = parseInt(params.patientId, 10);
		if (isNaN(patientId)) return fail(400, { error: 'Invalid patient ID' });

		const formData = await request.formData();
		const fileName = formData.get('file_name') as string;
		if (!fileName) return fail(400, { error: 'File name is required' });

		const supabase = locals.supabase;
		const { data: patientFile, error: patientFileError } = await supabase
			.from('patients_files')
			.select('file_name')
			.eq('patient_id', patientId)
			.eq('file_name', fileName)
			.maybeSingle();

		if (patientFileError) {
			return fail(400, { error: patientFileError.message });
		}

		if (!patientFile) {
			return fail(404, { error: 'Patient file not found' });
		}

		const { error: storageDeleteError } = await supabase.storage.from('files').remove([fileName]);

		if (storageDeleteError) {
			return fail(400, { error: storageDeleteError.message });
		}

		// Remove the patient-file link
		const { error: unlinkError } = await supabase
			.from('patients_files')
			.delete()
			.eq('patient_id', patientId)
			.eq('file_name', fileName);

		if (unlinkError) {
			return fail(400, { error: unlinkError.message });
		}

		const { error: fileDeleteError } = await supabase.from('files').delete().eq('name', fileName);

		if (fileDeleteError) {
			return fail(400, { error: fileDeleteError.message });
		}

		logAudit(supabase, user.id, 'delete', 'patient_file', String(patientId), { fileName }, request);

		return { success: true };
	},

	updatePatientNote: async ({ locals, params, request }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const patientId = parseInt(params.patientId, 10);
		if (isNaN(patientId)) return fail(400, { error: 'Invalid patient ID' });

		const formData = await request.formData();
		const note = (formData.get('note') as string)?.trim() || null;
		const filesToRemove = formData.getAll('remove_files').map(String).filter(Boolean);
		const newFiles = formData.getAll('files') as File[];

		const supabase = locals.supabase;

		const { error: updateError } = await updatePatient(supabase, patientId, { note });
		if (updateError) {
			return fail(400, { error: updateError.message });
		}

		// Remove files marked for deletion (verify they belong to this patient first)
		for (const fileName of filesToRemove) {
			const { data: pf } = await supabase
				.from('patients_files')
				.select('file_name')
				.eq('patient_id', patientId)
				.eq('file_name', fileName)
				.maybeSingle();
			if (!pf) continue;

			await supabase.storage.from('files').remove([fileName]);
			await supabase
				.from('patients_files')
				.delete()
				.eq('patient_id', patientId)
				.eq('file_name', fileName);
			await supabase.from('files').delete().eq('name', fileName);
		}

		// Upload new files and link existing library files
		const uploadedFilePaths: string[] = [];
		try {
			for (const file of newFiles) {
				if (!file.size || !file.name) continue;

				const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
				const storagePath = await getPatientFilePath(supabase, patientId, safeName);

				const { error: uploadError } = await uploadFile(supabase, storagePath, file, {
					contentType: file.type
				});
				if (uploadError) throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);

				uploadedFilePaths.push(storagePath);

				await supabase
					.from('files')
					.insert({ name: storagePath, size: file.size, mimetype: file.type || null });
				await supabase
					.from('patients_files')
					.insert({ patient_id: patientId, file_name: storagePath });
			}
		} catch (err) {
			if (uploadedFilePaths.length > 0) {
				await supabase.storage.from('files').remove(uploadedFilePaths);
				for (const fp of uploadedFilePaths) {
					await supabase.from('files').delete().eq('name', fp);
					await supabase.from('patients_files').delete().eq('file_name', fp);
				}
			}
			const message = err instanceof Error ? err.message : 'Failed to save files';
			return fail(400, { error: message });
		}

		logAudit(
			locals.supabase,
			user.id,
			'update',
			'patient',
			String(patientId),
			{ field: 'note' },
			request
		);

		return { success: true };
	},

	copyDenial: async ({ locals, params, request }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const patientId = parseInt(params.patientId, 10);
		if (isNaN(patientId)) return fail(400, { error: 'Invalid patient ID' });

		const formData = await request.formData();

		const sourceDenialId = parseInt(formData.get('source_denial_id') as string, 10);
		if (isNaN(sourceDenialId)) return fail(400, { error: 'Invalid source denial ID' });

		const serviceStartDate = formData.get('service_start_date') as string;
		if (!serviceStartDate) return fail(400, { error: 'Service start date is required' });

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
		const copyNoteIds = formData
			.getAll('copy_note_ids')
			.map(Number)
			.filter((n) => !isNaN(n));

		const supabase = locals.supabase;

		// Create the new denial
		const { data: newDenial, error: createError } = await createDenial(
			supabase,
			{
				patient_id: patientId,
				service_start_date: serviceStartDate,
				service_end_date: serviceEndDate,
				billed_amount: billedAmount,
				paid_amount: paidAmount,
				follow_up_date: followUpDate,
				is_closed: false
			},
			insuranceIds.length ? insuranceIds : undefined,
			labelIds.length ? labelIds : undefined
		);

		if (createError || !newDenial) {
			return fail(400, { error: createError?.message ?? 'Failed to create denial' });
		}

		// Copy selected notes (re-fetched server-side to prevent client tampering)
		if (copyNoteIds.length > 0) {
			const { data: sourceNotes } = await supabase
				.from('notes')
				.select('id, note')
				.eq('denial_id', sourceDenialId)
				.in('id', copyNoteIds);

			if (sourceNotes?.length) {
				for (const sourceNote of sourceNotes) {
					await createNote(supabase, {
						denial_id: newDenial.id,
						note: sourceNote.note,
						created_by: user.id
					});
				}
			}
		}

		logAudit(
			supabase,
			user.id,
			'create',
			'denial',
			String(newDenial.id),
			{ copied_from: sourceDenialId },
			request
		);

		return { success: true };
	}
};
