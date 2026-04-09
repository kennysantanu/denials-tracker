import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getFilesByDate } from '$lib/server/db/files';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, url, request }) => {
	const user = await locals.getUser();
	if (!user) {
		redirect(303, '/signin');
	}

	const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

	const { data: files, error } = await getFilesByDate(locals.supabase, date);

	logAudit(locals.supabase, user.id, 'view', 'file', null, { date }, request);

	return {
		files: files ?? [],
		selectedDate: date
	};
};
