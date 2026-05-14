import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

/**
 * Get every active canonical permission from the catalog.
 * Used by admin UIs to render the editable permission grid.
 */
export function getPermissionCatalog(supabase: SupabaseClient<Database>) {
	return supabase
		.from('permission_catalog')
		.select('key, category, description, risk_level, is_kpi_relevant')
		.eq('is_active', true)
		.order('category')
		.order('key');
}

/**
 * Get the new->legacy entries from the compatibility map.
 * Used to derive the legacy `roles.permissions` JSON whenever a role's
 * canonical grants change (so dual-read consumers stay in sync).
 */
export async function getCanonicalToLegacyMap(
	supabase: SupabaseClient<Database>
): Promise<Map<string, string[]>> {
	const { data } = await supabase
		.from('permission_compatibility_map')
		.select('legacy_key, permission_key, direction')
		.in('direction', ['new_to_legacy', 'both'])
		.eq('is_active', true);

	const m = new Map<string, string[]>();
	for (const row of data ?? []) {
		if (!m.has(row.permission_key)) m.set(row.permission_key, []);
		m.get(row.permission_key)!.push(row.legacy_key);
	}
	return m;
}

/**
 * Given a set of canonical keys + the new->legacy map, build the legacy
 * `roles.permissions` JSON shape.
 *
 * The shape is `Record<legacy_key, true>` - we only emit truthy entries.
 */
export function deriveLegacyPermissionsJson(
	canonicalKeys: string[],
	canonicalToLegacy: Map<string, string[]>
): Record<string, boolean> {
	const result: Record<string, boolean> = {};
	for (const k of canonicalKeys) {
		const legacyKeys = canonicalToLegacy.get(k) ?? [];
		for (const legacyKey of legacyKeys) result[legacyKey] = true;
	}
	return result;
}

/**
 * Full atomic dual-write for a role's permissions:
 * 1. Replace `role_permissions` rows via the SQL function.
 * 2. Update `roles.permissions` legacy JSON to mirror.
 *
 * Returns `{ error }` on the first failure, otherwise `{ error: null }`.
 */
export async function setRolePermissions(
	supabase: SupabaseClient<Database>,
	roleId: number,
	canonicalKeys: string[],
	actorUserId: string | undefined
): Promise<{ error: { message: string } | null }> {
	const { error: rpcError } = await supabase.rpc('replace_role_permissions', {
		p_role_id: roleId,
		p_keys: canonicalKeys,
		p_actor_user_id: actorUserId ?? undefined
	});
	if (rpcError) return { error: rpcError };

	const map = await getCanonicalToLegacyMap(supabase);
	const legacyJson = deriveLegacyPermissionsJson(canonicalKeys, map);

	const { error: updateError } = await supabase
		.from('roles')
		.update({ permissions: legacyJson })
		.eq('id', roleId);

	if (updateError) return { error: updateError };
	return { error: null };
}
