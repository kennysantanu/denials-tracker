import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

type FilesRow = Database['public']['Tables']['files']['Row'];

const BUCKET = 'files';

async function getPatientLinkedFileNamesInternal(
	supabase: SupabaseClient<Database>,
	fileNames: string[]
): Promise<{ data: string[]; error: PostgrestError | null }> {
	const uniqueNames = Array.from(new Set(fileNames.filter(Boolean)));

	if (uniqueNames.length === 0) {
		return { data: [], error: null };
	}

	const { data, error } = await supabase
		.from('patients_files')
		.select('file_name')
		.in('file_name', uniqueNames);

	if (error) {
		return { data: [], error };
	}

	return {
		data: (data ?? []).map((row) => row.file_name),
		error: null
	};
}

async function excludePatientLinkedFiles<T extends { name: string }>(
	supabase: SupabaseClient<Database>,
	files: T[]
): Promise<{ data: T[]; error: PostgrestError | null }> {
	if (files.length === 0) {
		return { data: files, error: null };
	}

	const patientFileNamesResult = await getPatientLinkedFileNamesInternal(
		supabase,
		files.map((file) => file.name)
	);

	if (patientFileNamesResult.error) {
		return { data: [], error: patientFileNamesResult.error };
	}

	const patientFileNames = new Set(patientFileNamesResult.data);

	return {
		data: files.filter((file) => !patientFileNames.has(file.name)),
		error: null
	};
}

async function getVersionedPathInFolder(
	supabase: SupabaseClient<Database>,
	folderPath: string,
	fileName: string
): Promise<string> {
	const dot = fileName.lastIndexOf('.');
	const base = dot >= 0 ? fileName.slice(0, dot) : fileName;
	const ext = dot >= 0 ? fileName.slice(dot) : '';

	let candidate = `${folderPath}/${fileName}`;
	let version = 2;

	while (true) {
		const { data } = await supabase
			.from('files')
			.select('name')
			.eq('name', candidate)
			.maybeSingle();
		if (!data) return candidate;
		candidate = `${folderPath}/${base}(${version})${ext}`;
		version++;
	}
}

export async function getFilesByDate(supabase: SupabaseClient<Database>, date: string) {
	const start = `${date}T00:00:00.000Z`;
	const end = `${date}T23:59:59.999Z`;

	const { data, error } = await supabase
		.from('files')
		.select('*')
		.gte('created_at', start)
		.lt('created_at', end)
		.order('created_at', { ascending: false });

	if (error || !data) {
		return { data: null, error };
	}

	const filteredFilesResult = await excludePatientLinkedFiles(supabase, data);

	if (filteredFilesResult.error) {
		return { data: null, error: filteredFilesResult.error };
	}

	return { data: filteredFilesResult.data, error: null };
}

export async function createSignedUrl(
	supabase: SupabaseClient<Database>,
	fileName: string,
	expiresIn: number = 60
) {
	return supabase.storage.from(BUCKET).createSignedUrl(fileName, expiresIn);
}

export async function uploadFile(
	supabase: SupabaseClient<Database>,
	fileName: string,
	file: File | Blob,
	options?: { contentType?: string }
) {
	return supabase.storage.from(BUCKET).upload(fileName, file, {
		contentType: options?.contentType
	});
}

export async function getVersionedPath(
	supabase: SupabaseClient<Database>,
	dateFolder: string,
	fileName: string
): Promise<string> {
	return getVersionedPathInFolder(supabase, dateFolder, fileName);
}

export async function getPatientFilePath(
	supabase: SupabaseClient<Database>,
	patientId: number,
	fileName: string
): Promise<string> {
	return getVersionedPathInFolder(supabase, `patients/${patientId}`, fileName);
}

export async function getPatientLinkedFileNames(
	supabase: SupabaseClient<Database>,
	fileNames: string[]
): Promise<{ data: string[]; error: PostgrestError | null }> {
	return getPatientLinkedFileNamesInternal(supabase, fileNames);
}

export async function getFileByName(supabase: SupabaseClient<Database>, name: string) {
	return supabase.from('files').select('*').eq('name', name).single();
}

export async function updateFileMetadata(
	supabase: SupabaseClient<Database>,
	name: string,
	metadata: { status?: string; note?: string }
) {
	return supabase.from('files').update({ metadata }).eq('name', name);
}

export async function getRelatedClaims(supabase: SupabaseClient<Database>, fileName: string) {
	return supabase
		.from('notes_files')
		.select(
			`
			note_id,
			notes!inner(
				id,
				note,
				created_at,
				created_by:users!public_notes_created_by_fkey(username),
				denial_id,
				denials!inner(
					id,
					service_start_date,
					service_end_date,
					patient_id,
					patients!inner(id, first_name, last_name, date_of_birth),
					denials_labels(labels(label_name, bg_color, txt_color))
				)
			)
		`
		)
		.eq('file_name', fileName);
}

export async function deleteFile(supabase: SupabaseClient<Database>, fileName: string) {
	const dbResult = await supabase.from('files').delete().eq('name', fileName);

	if (dbResult.error) {
		return dbResult;
	}

	const storageResult = await supabase.storage.from(BUCKET).remove([fileName]);

	if (storageResult.error) {
		return { data: null, error: storageResult.error };
	}

	return { data: storageResult.data, error: null };
}

export type DateStatus = 'new' | 'in-progress' | 'completed';

/**
 * Get the "worst" file status for each date in a given month.
 * Priority: new (red) > in-progress (yellow) > completed (blue).
 * Files without a metadata status default to 'new'.
 */
export async function getFileDateStatusesInMonth(
	supabase: SupabaseClient<Database>,
	year: number,
	month: number
): Promise<{ data: { date: string; status: DateStatus }[]; error: unknown }> {
	const startDate = `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`;
	const lastDay = new Date(year, month, 0).getDate();
	const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;

	const { data, error } = await supabase
		.from('files')
		.select('name, created_at, metadata')
		.gte('created_at', startDate)
		.lte('created_at', endDate)
		.order('created_at', { ascending: true });

	if (error) {
		return { data: [], error };
	}

	const filteredFilesResult = await excludePatientLinkedFiles(supabase, data ?? []);

	if (filteredFilesResult.error) {
		return { data: [], error: filteredFilesResult.error };
	}

	// Group by date, tracking worst status per day
	const dateStatuses = new Map<string, DateStatus>();
	for (const file of filteredFilesResult.data) {
		const day = file.created_at.split('T')[0];
		const meta = file.metadata as Record<string, unknown> | null;
		const rawStatus = (meta?.status as string) ?? 'New';
		const status: DateStatus =
			rawStatus === 'In Progress' ? 'in-progress' : rawStatus === 'Completed' ? 'completed' : 'new';

		const current = dateStatuses.get(day);
		// Priority: new > in-progress > completed
		if (!current || status === 'new' || (status === 'in-progress' && current === 'completed')) {
			dateStatuses.set(day, status);
		}
	}

	return {
		data: Array.from(dateStatuses.entries()).map(([date, status]) => ({ date, status })),
		error: null
	};
}
