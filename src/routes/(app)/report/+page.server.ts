import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getReportData } from '$lib/server/db/reports';
import { getOpenFollowUps, getNoFollowUpDenials, groupFollowUps } from '$lib/server/db/followups';
import type { FollowUpDenial } from '$lib/server/db/followups';
import { logAudit } from '$lib/server/audit';
import { requirePermission } from '$lib/server/authz';

export const load: PageServerLoad = async (event) => {
	const { locals, url, request } = event;
	const user = await locals.getUser();
	if (!user) redirect(303, '/signin');

	await requirePermission(event, 'report.read', { resourceType: 'report' });

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const todayStr = today.toISOString().split('T')[0];
	const last30Start = new Date(today);
	last30Start.setDate(last30Start.getDate() - 29);
	const last30StartStr = last30Start.toISOString().split('T')[0];

	const showAll = url.searchParams.get('all') === '1';
	const startDate = showAll ? '' : url.searchParams.get('startDate') || last30StartStr;
	const endDate = showAll ? '' : url.searchParams.get('endDate') || todayStr;
	const includeClosed = url.searchParams.get('includeClosed') === 'true';
	const dateModeParam = url.searchParams.get('dateMode');
	const dateMode: 'service' | 'lastNote' = dateModeParam === 'service' ? 'service' : 'lastNote';

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
