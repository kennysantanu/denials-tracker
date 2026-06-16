import { error, type RequestEvent } from '@sveltejs/kit';
import { logAppEvent } from './appEvents';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Source of an authorization decision. Always 'new' post-Phase 9a cutover.
 * Kept in the type for historical app_events rows and observability.
 */
export type PermissionSource = 'legacy' | 'new' | 'both' | 'system' | 'none';

export interface AuthorizeContext {
	resourceType?: string;
	resourceId?: string;
	subjectPatientId?: number | null;
	subjectDenialId?: number | null;
}

export interface AuthorizeResult {
	allowed: boolean;
	permissionKey: string;
	permissionSource: PermissionSource;
	roleIds: number[];
	reason?: string;
}

// ---------------------------------------------------------------------------
// authorize() - the single decision function used by every protected route.
// ---------------------------------------------------------------------------

/**
 * Resolve an authorization decision for the current request.
 * Reads `user_role_assignments -> role_permissions` (canonical store only).
 */
export async function authorize(
	event: RequestEvent,
	permissionKey: string,
	_context?: AuthorizeContext
): Promise<AuthorizeResult> {
	const user = await event.locals.getUser();

	if (!user) {
		return {
			allowed: false,
			permissionKey,
			permissionSource: 'none',
			roleIds: [],
			reason: 'no authenticated user'
		};
	}

	const supabase = event.locals.supabase;

	// Resolve via user_role_assignments -> role_permissions (canonical store only).
	const { data: assignments } = await supabase
		.from('user_role_assignments')
		.select('role_id')
		.eq('user_id', user.id)
		.is('revoked_at', null);

	const roleIds = (assignments ?? []).map((a) => a.role_id);
	let allowed = false;

	if (roleIds.length > 0) {
		const { data: rps } = await supabase
			.from('role_permissions')
			.select('permission_key')
			.in('role_id', roleIds)
			.eq('permission_key', permissionKey)
			.limit(1);

		allowed = (rps ?? []).length > 0;
	}

	return {
		allowed,
		permissionKey,
		permissionSource: allowed ? 'new' : 'none',
		roleIds,
		reason: allowed ? undefined : `no grant for ${permissionKey}`
	};
}

// ---------------------------------------------------------------------------
// requirePermission() - throws SvelteKit 403 + emits a denied app_event.
// ---------------------------------------------------------------------------

/**
 * Authorize and throw a SvelteKit `error(403)` if denied. Emits an
 * `authorization.denied` row to `app_events` on denial (non-blocking).
 *
 * Returns the AuthorizeResult on success so callers can use the resolved
 * source / roleIds for downstream success events.
 */
export async function requirePermission(
	event: RequestEvent,
	permissionKey: string,
	context?: AuthorizeContext
): Promise<AuthorizeResult> {
	const result = await authorize(event, permissionKey, context);

	if (!result.allowed) {
		const user = await event.locals.getUser();
		logAppEvent(event.locals.supabase, {
			eventName: 'authorization.denied',
			featureArea: 'authz',
			outcome: 'denied',
			actorUserId: user?.id ?? null,
			actorRoleIds: result.roleIds,
			permissionKey,
			permissionSource: 'none',
			resourceType: context?.resourceType ?? null,
			resourceId: context?.resourceId ?? null,
			subjectPatientId: context?.subjectPatientId ?? null,
			subjectDenialId: context?.subjectDenialId ?? null,
			requestId: event.locals.requestId,
			metadata: { reason: result.reason ?? null }
		});

		error(403, `Forbidden: missing permission "${permissionKey}"`);
	}

	return result;
}

// ---------------------------------------------------------------------------
// loadEffectivePermissions() - precompute the full canonical permission map
// for the layout. Used by (app)/+layout.server.ts to render UI affordances.
// ---------------------------------------------------------------------------

/**
 * Compute the full set of effective canonical permissions for the current
 * user. Used by the app layout so client components can do cheap lookups
 * (`effectivePermissions['denial.create']`) instead of re-querying.
 *
 * Returns `Record<string, boolean>` keyed by canonical permission key.
 */
export async function loadEffectivePermissions(
	event: RequestEvent
): Promise<Record<string, boolean>> {
	const user = await event.locals.getUser();
	if (!user) return {};

	const supabase = event.locals.supabase;

	// Catalog of all active canonical keys (excludes deprecated).
	const { data: catalog } = await supabase
		.from('permission_catalog')
		.select('key')
		.eq('is_active', true)
		.is('deprecated_at', null);

	const result: Record<string, boolean> = {};
	for (const row of catalog ?? []) result[row.key] = false;

	// Grants from canonical store: user_role_assignments -> role_permissions.
	const { data: assignments } = await supabase
		.from('user_role_assignments')
		.select('role_id')
		.eq('user_id', user.id)
		.is('revoked_at', null);

	const roleIds = (assignments ?? []).map((a) => a.role_id);
	if (roleIds.length > 0) {
		const { data: rps } = await supabase
			.from('role_permissions')
			.select('permission_key')
			.in('role_id', roleIds);

		for (const rp of rps ?? []) result[rp.permission_key] = true;
	}

	return result;
}
