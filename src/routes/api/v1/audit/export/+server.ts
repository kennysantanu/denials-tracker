import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuditLogs } from '$lib/server/db/audit';
import { logAudit } from '$lib/server/audit';

export const GET: RequestHandler = async ({ locals, url, request }) => {
	const user = await locals.getUser();
	if (!user) error(401, 'Unauthorized');

	// Load permissions
	const { data: userData } = await locals.supabase
		.from('users')
		.select('*, roles(*)')
		.eq('id', user.id)
		.single();

	const permissions =
		(userData?.roles as { permissions?: Record<string, boolean> } | null)?.permissions ?? {};

	if (!permissions['audit_read']) error(403, 'Forbidden: audit_read permission required');

	const userId = url.searchParams.get('userId') || undefined;
	const action = url.searchParams.get('action') || undefined;
	const resourceType = url.searchParams.get('resourceType') || undefined;
	const startDate = url.searchParams.get('startDate') || undefined;
	const endDate = url.searchParams.get('endDate') || undefined;

	// Fetch all matching records (no pagination for export)
	const { data: logs, error: dbError } = await getAuditLogs(locals.supabase, {
		page: 1,
		pageSize: 10000,
		filters: { userId, action, resourceType, startDate, endDate }
	});

	if (dbError) error(500, 'Failed to export audit logs');

	// Build CSV
	const headers = ['id', 'created_at', 'user_id', 'action', 'resource_type', 'resource_id', 'ip_address', 'user_agent', 'details'];
	const rows = (logs ?? []).map((log) =>
		headers.map((h) => {
			const val = (log as Record<string, unknown>)[h];
			if (val === null || val === undefined) return '';
			const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
			// Escape CSV: wrap in quotes if contains comma, quote, or newline
			if (str.includes(',') || str.includes('"') || str.includes('\n')) {
				return `"${str.replace(/"/g, '""')}"`;
			}
			return str;
		}).join(',')
	);

	const csv = [headers.join(','), ...rows].join('\n');

	logAudit(locals.supabase, user.id, 'export', 'audit_log', null, { filters: { userId, action, resourceType, startDate, endDate }, count: logs?.length ?? 0 }, request);

	return new Response(csv, {
		status: 200,
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="audit_log_${new Date().toISOString().split('T')[0]}.csv"`,
			'Cache-Control': 'no-store'
		}
	});
};
