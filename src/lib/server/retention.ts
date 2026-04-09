import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

/**
 * Soft-delete a patient by setting is_active = false.
 */
export async function archivePatient(supabase: SupabaseClient<Database>, patientId: number) {
	return supabase
		.from('patients')
		.update({ is_active: false })
		.eq('id', patientId)
		.select()
		.single();
}

/**
 * Hard-delete a patient and all related records.
 * Use only when legally required (e.g., data disposal after retention period).
 */
export async function hardDeletePatient(supabase: SupabaseClient<Database>, patientId: number) {
	// Delete files from storage for this patient
	const { data: patientFiles } = await supabase
		.from('patients_files')
		.select('file_name')
		.eq('patient_id', patientId);

	if (patientFiles?.length) {
		const fileNames = patientFiles.map((f) => f.file_name);

		// Remove from storage
		await supabase.storage.from('files').remove(fileNames);

		// Remove junction rows
		await supabase.from('patients_files').delete().eq('patient_id', patientId);

		// Remove file metadata rows
		for (const name of fileNames) {
			await supabase.from('files').delete().eq('name', name);
		}
	}

	// Delete denials and their junction tables
	const { data: denials } = await supabase
		.from('denials')
		.select('id')
		.eq('patient_id', patientId);

	if (denials?.length) {
		const denialIds = denials.map((d) => d.id);

		for (const denialId of denialIds) {
			// Delete notes_files junctions for notes on this denial
			const { data: notes } = await supabase
				.from('notes')
				.select('id')
				.eq('denial_id', denialId);

			if (notes?.length) {
				for (const note of notes) {
					await supabase.from('notes_files').delete().eq('note_id', note.id);
				}
				await supabase.from('notes').delete().eq('denial_id', denialId);
			}

			await supabase.from('denials_insurances').delete().eq('denial_id', denialId);
			await supabase.from('denials_labels').delete().eq('denial_id', denialId);
		}

		await supabase.from('denials').delete().eq('patient_id', patientId);
	}

	// Delete the patient
	return supabase.from('patients').delete().eq('id', patientId);
}

/**
 * Prune old audit logs beyond a retention period.
 * Default retention: 7 years (HIPAA requires 6 years minimum).
 */
export async function pruneAuditLogs(
	supabase: SupabaseClient<Database>,
	retentionDays: number = 2555
) {
	const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

	return supabase.from('audit_log').delete().lt('created_at', cutoffDate);
}
