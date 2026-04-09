import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	getDashboardStats,
	getRecentActivity,
	getFollowUpsDueThisWeek,
	getDenialsByLabel
} from '$lib/server/db/dashboard';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, parent, request }) => {
	const user = await locals.getUser();
	if (!user) {
		redirect(303, '/signin');
	}

	const { permissions } = await parent();
	const supabase = locals.supabase;

	const [statsResult, activityResult, followUpsResult, labelResult] = await Promise.all([
		getDashboardStats(supabase),
		getRecentActivity(supabase, 10),
		getFollowUpsDueThisWeek(supabase),
		getDenialsByLabel(supabase)
	]);

	const canViewReports = !!permissions['view_reports'];
	const canCreateDenial = !!permissions['create_denial'];
	const canManagePatients = !!permissions['manage_patients'];

	// Gate financial stats behind view_reports permission
	const stats = statsResult.data
		? {
				totalOpen: statsResult.data.totalOpen,
				totalBilled: canViewReports ? statsResult.data.totalBilled : null,
				totalPaid: canViewReports ? statsResult.data.totalPaid : null,
				recoveryRate: canViewReports ? statsResult.data.recoveryRate : null
			}
		: { totalOpen: 0, totalBilled: null, totalPaid: null, recoveryRate: null };

	// Log PHI access
	logAudit(supabase, user.id, 'view', 'dashboard', null, undefined, request);

	return {
		stats,
		recentActivity: activityResult.data ?? [],
		followUps: followUpsResult.data ?? [],
		denialsByLabel: labelResult.data ?? [],
		canViewReports,
		canCreateDenial,
		canManagePatients
	};
};
