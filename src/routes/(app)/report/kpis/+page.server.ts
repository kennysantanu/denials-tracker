import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requirePermission, loadEffectivePermissions } from '$lib/server/authz';
import { logAudit } from '$lib/server/audit';

type Scope = 'self' | 'team' | 'all';

type UserKpiRow = {
	user_id: string;
	day: string;
	events_total: number;
	denials_created: number;
	denials_updated: number;
	denials_closed: number;
	denials_reopened: number;
	denials_deleted: number;
	denials_worked: number;
	distinct_denials_touched: number;
	distinct_patients_touched: number;
	notes_created: number;
	notes_updated: number;
	notes_deleted: number;
	files_uploaded: number;
	files_deleted: number;
	patients_created: number;
	patients_updated: number;
	ai_invocations: number;
	auth_denials: number;
	failures: number;
};

type RoleKpiRow = {
	role_id: number;
	role_name: string;
	day: string;
	active_users: number;
	events_total: number;
	denials_worked: number;
	distinct_denials_touched: number;
	notes_created: number;
	files_uploaded: number;
	ai_invocations: number;
	auth_denials: number;
	failures: number;
};

type PermUsageRow = {
	permission_key: string;
	day: string;
	outcome: 'success' | 'denied' | 'failed';
	permission_source: string;
	event_count: number;
	distinct_actors: number;
};

type DenialRow = {
	user_id: string | null;
	permission_key: string | null;
	day: string;
	denial_count: number;
	distinct_resources: number;
	last_denied_at: string;
};

export const load: PageServerLoad = async (event) => {
	const { locals, url, request } = event;
	const user = await locals.getUser();
	if (!user) redirect(303, '/signin');

	const effective = await loadEffectivePermissions(event);
	const canSelf = effective['kpi.read.self'] === true;
	const canTeam = effective['kpi.read.team'] === true;
	const canAll = effective['kpi.read.all'] === true;

	if (!canSelf && !canTeam && !canAll) {
		await requirePermission(event, 'kpi.read.self', { resourceType: 'kpi' });
	}

	// Resolve requested scope, clamped to the highest scope the user can see.
	const requested = (url.searchParams.get('scope') ?? '').toLowerCase();
	let scope: Scope = 'self';
	if (requested === 'all' && canAll) scope = 'all';
	else if (requested === 'team' && (canTeam || canAll)) scope = 'team';
	else if (canAll) scope = 'all';
	else if (canTeam) scope = 'team';
	else scope = 'self';

	const days = Math.min(Math.max(parseInt(url.searchParams.get('days') ?? '30', 10) || 30, 1), 365);
	const since = new Date();
	since.setHours(0, 0, 0, 0);
	since.setDate(since.getDate() - (days - 1));
	const sinceStr = since.toISOString();

	const supabase = locals.supabase;

	// user_daily_kpis
	let userQuery = (supabase as any)
		.from('user_daily_kpis')
		.select('*')
		.gte('day', sinceStr.slice(0, 10))
		.order('day', { ascending: false })
		.order('events_total', { ascending: false });
	if (scope === 'self') {
		userQuery = userQuery.eq('user_id', user.id);
	}
	const { data: userRows, error: userErr } = await userQuery;
	if (userErr) {
		console.error('[reports/kpis] user_daily_kpis error', userErr);
		error(500, 'Failed to load KPI data');
	}

	// Hydrate user_id -> display name for team/all scopes.
	let userLookup: Record<string, string> = {};
	if (scope !== 'self' && userRows && userRows.length > 0) {
		const ids = Array.from(
			new Set((userRows as UserKpiRow[]).map((r) => r.user_id).filter(Boolean))
		);
		if (ids.length > 0) {
			const { data: userMeta } = await supabase.from('users').select('id, username').in('id', ids);
			for (const u of userMeta ?? []) {
				userLookup[u.id] = u.username || u.id;
			}
		}
	}

	// role_daily_kpis - only meaningful for team/all
	let roleRows: RoleKpiRow[] = [];
	if (scope !== 'self') {
		const { data, error: roleErr } = await (supabase as any)
			.from('role_daily_kpis')
			.select('*')
			.gte('day', sinceStr.slice(0, 10))
			.order('day', { ascending: false })
			.order('events_total', { ascending: false });
		if (roleErr) {
			console.error('[reports/kpis] role_daily_kpis error', roleErr);
		} else {
			roleRows = (data ?? []) as RoleKpiRow[];
		}
	}

	// permission_usage_daily - admin-only insight
	let permUsage: PermUsageRow[] = [];
	let authDenials: DenialRow[] = [];
	if (canAll) {
		const [{ data: pu, error: puErr }, { data: ad, error: adErr }] = await Promise.all([
			(supabase as any)
				.from('permission_usage_daily')
				.select('*')
				.gte('day', sinceStr.slice(0, 10))
				.order('day', { ascending: false })
				.order('event_count', { ascending: false })
				.limit(500),
			(supabase as any)
				.from('authorization_denials_daily')
				.select('*')
				.gte('day', sinceStr.slice(0, 10))
				.order('day', { ascending: false })
				.order('denial_count', { ascending: false })
				.limit(200)
		]);
		if (puErr) console.error('[reports/kpis] permission_usage_daily error', puErr);
		if (adErr) console.error('[reports/kpis] authorization_denials_daily error', adErr);
		permUsage = (pu ?? []) as unknown as PermUsageRow[];
		authDenials = (ad ?? []) as unknown as DenialRow[];
	}

	logAudit(supabase, user.id, 'view', 'kpi_report', null, { scope, days }, request);

	return {
		scope,
		availableScopes: {
			self: canSelf || canTeam || canAll,
			team: canTeam || canAll,
			all: canAll
		},
		days,
		userRows: (userRows ?? []) as unknown as UserKpiRow[],
		userLookup,
		roleRows,
		permUsage,
		authDenials
	};
};
