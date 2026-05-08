import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getReportData } from '$lib/server/db/reports';
import { getOpenFollowUps, getNoFollowUpDenials, groupFollowUps } from '$lib/server/db/followups';
import type { FollowUpDenial } from '$lib/server/db/followups';
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
	const dateModeParam = url.searchParams.get('dateMode');
	const dateMode: 'service' | 'lastNote' = dateModeParam === 'lastNote' ? 'lastNote' : 'service';

	const [reportResult, followUpsResult, noDateResult] = await Promise.all([
		getReportData(locals.supabase, { startDate, endDate, includeClosed, dateMode }),
		getOpenFollowUps(locals.supabase),
		getNoFollowUpDenials(locals.supabase)
	]);

	if (reportResult.error) error(500, 'Failed to load report data');

	const grouped = groupFollowUps((followUpsResult.data ?? []) as unknown as FollowUpDenial[]);
	grouped.noDate = (noDateResult.data ?? []) as unknown as FollowUpDenial[];

	logAudit(
		locals.supabase,
		user.id,
		'view',
		'report',
		null,
		{ startDate, endDate, includeClosed, dateMode },
		request
	);

	return {
		reportData: reportResult.data ?? [],
		startDate,
		endDate,
		includeClosed,
		dateMode,
		grouped
	};
};
