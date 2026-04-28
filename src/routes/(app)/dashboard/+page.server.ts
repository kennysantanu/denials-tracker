import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getOpenFollowUps, getNoFollowUpDenials, groupFollowUps } from '$lib/server/db/followups';
import type { FollowUpDenial } from '$lib/server/db/followups';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, parent, request }) => {
	const user = await locals.getUser();
	if (!user) {
		redirect(303, '/signin');
	}

	const { permissions } = await parent();
	const supabase = locals.supabase;

	const [followUpsResult, noDateResult] = await Promise.all([
		getOpenFollowUps(supabase),
		getNoFollowUpDenials(supabase)
	]);

	const canCreateDenial = !!permissions['create_denial'];
	const canManagePatients = !!permissions['manage_patients'];

	const grouped = groupFollowUps((followUpsResult.data ?? []) as unknown as FollowUpDenial[]);
	grouped.noDate = (noDateResult.data ?? []) as unknown as FollowUpDenial[];

	// Log PHI access
	logAudit(supabase, user.id, 'view', 'dashboard', null, undefined, request);

	return {
		grouped,
		counts: {
			overdue: grouped.overdue.length,
			thisWeek: grouped.thisWeek.length,
			upcoming: grouped.upcoming.length,
			noDate: grouped.noDate.length,
			total:
				grouped.overdue.length +
				grouped.thisWeek.length +
				grouped.upcoming.length +
				grouped.noDate.length
		},
		canCreateDenial,
		canManagePatients
	};
};
