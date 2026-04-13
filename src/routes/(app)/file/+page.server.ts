import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getFilesByDate, getFileDateStatusesInMonth, type DateStatus } from '$lib/server/db/files';
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
