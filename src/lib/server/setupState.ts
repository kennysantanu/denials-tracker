import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { getServerSupabaseUrl } from '$lib/server/supabaseUrl';
import type { Database } from '$lib/supabase';

// Cached after the first observation of a non-zero user count. Setup is a
// one-way transition (you cannot go back to "zero users" from the app), so
// once true it can stay true for the lifetime of the process.
let systemInitialized = false;
let adminClient: SupabaseClient<Database> | null = null;

function getAdminClient(): SupabaseClient<Database> {
	if (!adminClient) {
		adminClient = createClient<Database>(getServerSupabaseUrl(), env.SUPABASE_SERVICE_ROLE_KEY, {
			auth: { persistSession: false, autoRefreshToken: false }
		});
	}
	return adminClient;
}

/**
 * Returns true when at least one user exists in `public.users`.
 *
 * Uses the service-role client because every public.users RLS policy is
 * `TO authenticated`; a request from a logged-out visitor (anon) would
 * otherwise see zero rows regardless of reality, which would incorrectly
 * trigger the first-time setup redirect on every signin attempt.
 */
export async function isSystemInitialized(): Promise<boolean> {
	if (systemInitialized) return true;

	const { count, error } = await getAdminClient()
		.from('users')
		.select('*', { count: 'exact', head: true });

	if (error) {
		console.error('[setup-state] failed to read users count:', error);
		// Fail closed for the redirect logic: assume initialized so we never
		// accidentally let an anonymous visitor reach /setup.
		return true;
	}

	if (count !== null && count > 0) {
		systemInitialized = true;
		return true;
	}
	return false;
}
