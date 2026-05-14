import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getFilesByDate, getFileDateStatusesInMonth, type DateStatus } from '$lib/server/db/files';
import { requirePermission } from '$lib/server/authz';

export async function GET(event: RequestEvent) {
	const { locals, url } = event;
	const user = await locals.getUser();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	await requirePermission(event, 'file.read', { resourceType: 'file' });

	const date = url.searchParams.get('date');
	if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return json({ error: 'Invalid date parameter' }, { status: 400 });
	}

	const [year, month] = date.split('-').map(Number);

	const [filesResult, statusesResult] = await Promise.all([
		getFilesByDate(locals.supabase, date),
		getFileDateStatusesInMonth(locals.supabase, year, month)
	]);

	if (filesResult.error) {
		return json({ error: filesResult.error.message }, { status: 500 });
	}

	const dateStatuses: Record<string, DateStatus> = {};
	for (const entry of statusesResult.data) {
		dateStatuses[entry.date] = entry.status;
	}

	return json({
		files: filesResult.data ?? [],
		dateStatuses
	});
}
