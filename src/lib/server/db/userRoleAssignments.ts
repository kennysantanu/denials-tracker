import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

/**
 * Atomically switch a user's active role assignment.
 *
 * Revokes any active row in `user_role_assignments`, then inserts a new row
 * for the target role. The partial unique index
 * `user_role_assignments_one_active_role_per_user` enforces that only one
 * active row exists at a time, so the revoke must complete first.
 *
 * If `roleId` is null, only the active row is revoked (no replacement).
 *
 * **Requires the service-role client.** RLS only grants SELECT on the table
 * to `authenticated`; mutations need `service_role`.
 */
export async function setUserActiveRole(
	adminClient: SupabaseClient<Database>,
	userId: string,
	roleId: number | null,
	actorUserId: string | null,
	reason?: string
): Promise<{ error: { message: string } | null }> {
	const now = new Date().toISOString();

	const { error: revokeError } = await adminClient
		.from('user_role_assignments')
		.update({ revoked_at: now, revoked_by: actorUserId, reason: reason ?? null })
		.eq('user_id', userId)
		.is('revoked_at', null);

	if (revokeError) return { error: revokeError };

	if (roleId === null) return { error: null };

	const { error: insertError } = await adminClient.from('user_role_assignments').insert({
		user_id: userId,
		role_id: roleId,
		assigned_by: actorUserId,
		reason: reason ?? null
	});

	if (insertError) return { error: insertError };
	return { error: null };
}
