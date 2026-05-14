import { error, type RequestEvent } from '@sveltejs/kit';
import { logAppEvent } from './appEvents';
import type { Permission } from '$lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Source of an authorization decision. Used for observability + the gradual
 * cutover from legacy keys to canonical keys.
 *
 * - `legacy`  - decision made from the legacy `roles.permissions` JSON only
 * - `new`     - decision made from `role_permissions` only
 * - `both`    - both stores agree
 * - `system`  - bypass (unused today, reserved for future system actors)
 * - `none`    - permission denied
 */
export type PermissionSource = 'legacy' | 'new' | 'both' | 'system' | 'none';

/**
 * Engine flag controlling which stores are consulted.
 *
 * - `legacy` - rollback mode; only legacy `roles.permissions` is read.
 * - `dual`   - default during migration; both stores are read, allow if either grants.
 * - `new`    - post-cutover; only `role_permissions` is read.
 *
 * Set via `PERMISSION_ENGINE` env var. Defaults to `dual`.
 */
export type PermissionEngine = 'legacy' | 'dual' | 'new';

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
// Engine flag
// ---------------------------------------------------------------------------

export function getPermissionEngine(): PermissionEngine {
	const raw = process.env.PERMISSION_ENGINE?.toLowerCase();
	if (raw === 'legacy' || raw === 'new') return raw;
	return 'dual';
}

// ---------------------------------------------------------------------------
// authorize() - the single decision function used by every protected route.
// ---------------------------------------------------------------------------

/**
 * Resolve an authorization decision for the current request.
 *
 * Reads both legacy (`users.role -> roles.permissions`) and new
 * (`user_role_assignments -> role_permissions`) stores per the engine flag,
 * resolves equivalences via `permission_compatibility_map`, and returns a
 * structured result. Does NOT throw or emit events on its own - callers
 * choose between `authorize()` (returns a result) and `requirePermission()`
 * (throws 403 + emits a denied event).
 *
 * @param permissionKey - either a canonical key (`denial.read`) or a legacy
 *   key (`view_denials`). Both are normalized internally.
 */
export async function authorize(
	event: RequestEvent,
	permissionKey: string,
	_context?: AuthorizeContext
): Promise<AuthorizeResult> {
	const engine = getPermissionEngine();
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

	// 1) Legacy effective set: users.role -> roles.permissions JSON
	let legacyAllowed = false;
	let legacyRoleId: number | null = null;
	if (engine === 'legacy' || engine === 'dual') {
		const { data: userData } = await supabase
			.from('users')
			.select('role, roles(permissions)')
			.eq('id', user.id)
			.maybeSingle();

		legacyRoleId = (userData?.role as number | null) ?? null;
		const legacyPerms =
			(userData?.roles as { permissions?: Record<string, boolean> } | null)?.permissions ?? {};

		// Try direct match (legacy key OR canonical key stored verbatim, just in case)
		if (legacyPerms[permissionKey] === true) {
			legacyAllowed = true;
		} else {
			// If permissionKey is canonical, look up which legacy keys map to it
			// and check if any of those are granted.
			const { data: maps } = await supabase
				.from('permission_compatibility_map')
				.select('legacy_key, direction')
				.eq('permission_key', permissionKey)
				.eq('is_active', true)
				.in('direction', ['legacy_to_new', 'both']);

			for (const m of maps ?? []) {
				if (legacyPerms[m.legacy_key] === true) {
					legacyAllowed = true;
					break;
				}
			}
		}
	}

	// 2) New effective set: user_role_assignments -> role_permissions
	let newAllowed = false;
	const newRoleIds: number[] = [];
	if (engine === 'new' || engine === 'dual') {
		const { data: assignments } = await supabase
			.from('user_role_assignments')
			.select('role_id')
			.eq('user_id', user.id)
			.is('revoked_at', null);

		for (const a of assignments ?? []) newRoleIds.push(a.role_id);

		if (newRoleIds.length > 0) {
			// Direct check against canonical key
			const candidateKeys = new Set<string>([permissionKey]);

			// If permissionKey is legacy, expand to its canonical keys via the map
			const { data: maps } = await supabase
				.from('permission_compatibility_map')
				.select('permission_key, direction')
				.eq('legacy_key', permissionKey)
				.eq('is_active', true)
				.in('direction', ['legacy_to_new', 'both']);

			for (const m of maps ?? []) candidateKeys.add(m.permission_key);

			const { data: rps } = await supabase
				.from('role_permissions')
				.select('permission_key')
				.in('role_id', newRoleIds)
				.in('permission_key', [...candidateKeys]);

			newAllowed = (rps ?? []).length > 0;
		}
	}

	// 3) Combine results based on engine
	const allowed =
		engine === 'legacy'
			? legacyAllowed
			: engine === 'new'
				? newAllowed
				: legacyAllowed || newAllowed;

	let source: PermissionSource;
	if (!allowed) source = 'none';
	else if (engine === 'legacy') source = 'legacy';
	else if (engine === 'new') source = 'new';
	else if (legacyAllowed && newAllowed) source = 'both';
	else if (legacyAllowed) source = 'legacy';
	else source = 'new';

	const roleIds = newRoleIds.length > 0 ? newRoleIds : legacyRoleId != null ? [legacyRoleId] : [];

	return {
		allowed,
		permissionKey,
		permissionSource: source,
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
	const engine = getPermissionEngine();
	const user = await event.locals.getUser();
	if (!user) return {};

	const supabase = event.locals.supabase;

	// 1) Catalog of all canonical keys (active only).
	const { data: catalog } = await supabase
		.from('permission_catalog')
		.select('key')
		.eq('is_active', true);

	const result: Record<string, boolean> = {};
	for (const row of catalog ?? []) result[row.key] = false;

	// 2) Grants from new store (role_permissions via active assignments).
	if (engine === 'new' || engine === 'dual') {
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
	}

	// 3) Grants implied by legacy store (legacy key -> canonical via map).
	if (engine === 'legacy' || engine === 'dual') {
		const { data: userData } = await supabase
			.from('users')
			.select('roles(permissions)')
			.eq('id', user.id)
			.maybeSingle();

		const legacyPerms =
			(userData?.roles as { permissions?: Record<string, boolean> } | null)?.permissions ?? {};

		const truthyLegacyKeys = Object.entries(legacyPerms)
			.filter(([, v]) => v === true)
			.map(([k]) => k);

		if (truthyLegacyKeys.length > 0) {
			const { data: maps } = await supabase
				.from('permission_compatibility_map')
				.select('legacy_key, permission_key, direction')
				.in('legacy_key', truthyLegacyKeys)
				.eq('is_active', true)
				.in('direction', ['legacy_to_new', 'both']);

			for (const m of maps ?? []) result[m.permission_key] = true;
		}
	}

	return result;
}

// ---------------------------------------------------------------------------
// Convenience: legacy-key check that mirrors the existing UI helper but uses
// the dual-read engine. Useful while migrating individual routes.
// ---------------------------------------------------------------------------

export async function hasLegacyPermission(event: RequestEvent, key: Permission): Promise<boolean> {
	const r = await authorize(event, key);
	return r.allowed;
}
