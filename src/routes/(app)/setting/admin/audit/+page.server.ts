import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuditLogs } from '$lib/server/db/audit';
import { logAudit } from '$lib/server/audit';
import { getUsers } from '$lib/server/db/users';

export const load: PageServerLoad = async ({ locals, parent, url, request }) => {
	const user = await locals.getUser();
	if (!user) redirect(303, '/signin');

	const { permissions } = await parent();
	if (!permissions['audit_read']) error(403, 'Forbidden: audit_read permission required');

	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
	const pageSize = Math.min(
		100,
		Math.max(10, parseInt(url.searchParams.get('pageSize') ?? '25', 10))
	);
	const userId = url.searchParams.get('userId') || undefined;
	const action = url.searchParams.get('action') || undefined;
	const resourceType = url.searchParams.get('resourceType') || undefined;
	const startDate = url.searchParams.get('startDate') || undefined;
	const endDate = url.searchParams.get('endDate') || undefined;

	const [{ data: logs, count, error: dbError }, { data: users }] = await Promise.all([
		getAuditLogs(locals.supabase, {
			page,
			pageSize,
			filters: { userId, action, resourceType, startDate, endDate }
		}),
		getUsers(locals.supabase)
	]);

	if (dbError) error(500, 'Failed to load audit logs');

	logAudit(
		locals.supabase,
		user.id,
		'view',
		'audit_log',
		null,
		{ page, filters: { userId, action, resourceType, startDate, endDate } },
		request
	);

	return {
		logs: logs ?? [],
		totalCount: count ?? 0,
		page,
		pageSize,
		filters: { userId, action, resourceType, startDate, endDate },
		users: users ?? []
	};
};
