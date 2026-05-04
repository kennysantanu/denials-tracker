import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
	getFilesByDate,
	getFileDateStatusesInMonth,
	uploadFile,
	getVersionedPath,
	type DateStatus
} from '$lib/server/db/files';
import { logAudit } from '$lib/server/audit';

export const load = (async ({ locals, url, request }) => {
	const user = await locals.getUser();
	if (!user) {
		redirect(303, '/signin');
	}

	const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
	const [year, month] = date.split('-').map(Number);

	const [filesResult, statusesResult] = await Promise.all([
		getFilesByDate(locals.supabase, date),
		getFileDateStatusesInMonth(locals.supabase, year, month)
	]);

	logAudit(locals.supabase, user.id, 'view', 'file', null, { date }, request);

	// Convert to Record<string, DateStatus> for the calendar component
	const dateStatuses: Record<string, DateStatus> = {};
	for (const entry of statusesResult.data) {
		dateStatuses[entry.date] = entry.status;
	}

	return {
		files: filesResult.data ?? [],
		selectedDate: date,
		dateStatuses
	};
}) satisfies PageServerLoad;

export const actions: Actions = {
	uploadNewFile: async ({ locals, request }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

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

			logAudit(
				supabase,
				user.id,
				'file_upload',
				'file',
				null,
				{ fileCount: uploadedFilePaths.length },
				request
			);

			return { success: true };
		} catch (err) {
			if (uploadedFilePaths.length > 0) {
				await supabase.storage.from('files').remove(uploadedFilePaths);
				for (const fp of uploadedFilePaths) {
					await supabase.from('files').delete().eq('name', fp);
				}
			}
			const message = err instanceof Error ? err.message : 'Failed to upload files';
			return fail(400, { error: message });
		}
	}
};
