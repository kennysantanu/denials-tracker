import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getReportData } from '$lib/server/db/reports';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, parent, url, request }) => {
	const user = await locals.getUser();
	if (!user) redirect(303, '/signin');

	const { permissions } = await parent();
	if (!permissions['view_reports']) error(403, 'Forbidden');

	const today = new Date();
	const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
		.toISOString()
		.split('T')[0];
	const todayStr = today.toISOString().split('T')[0];

	const startDate = url.searchParams.get('startDate') || startOfMonth;
	const endDate = url.searchParams.get('endDate') || todayStr;
	const includeClosed = url.searchParams.get('includeClosed') === 'true';

	const { data: reportData, error: dbError } = await getReportData(locals.supabase, {
		startDate,
		endDate,
		includeClosed
	});

	if (dbError) error(500, 'Failed to load report data');

	logAudit(locals.supabase, user.id, 'view', 'report', null, { startDate, endDate, includeClosed }, request);

	return {
		reportData: reportData ?? [],
		startDate,
		endDate,
		includeClosed
	};
};
