import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

/**
 * Get every active, non-deprecated canonical permission from the catalog.
 * Used by admin UIs to render the editable permission grid.
 */
export function getPermissionCatalog(supabase: SupabaseClient<Database>) {
	return supabase
		.from('permission_catalog')
		.select('key, category, description, risk_level, is_kpi_relevant')
		.eq('is_active', true)
		.is('deprecated_at', null)
		.order('category')
		.order('key');
}

/**
 * Replace a role's canonical permission grants atomically via the
 * `replace_role_permissions` SQL function.
 *
 * Returns `{ error }` on failure, otherwise `{ error: null }`.
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
	return { error: null };
}
