import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

type FilesRow = Database['public']['Tables']['files']['Row'];

const BUCKET = 'files';

export async function getFilesByDate(supabase: SupabaseClient<Database>, date: string) {
	const start = `${date}T00:00:00.000Z`;
	const end = `${date}T23:59:59.999Z`;

	return supabase
		.from('files')
		.select('*')
		.gte('created_at', start)
		.lt('created_at', end)
		.order('created_at', { ascending: false });
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
