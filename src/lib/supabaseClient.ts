import { createBrowserClient } from '@supabase/ssr';
import { env } from '$env/dynamic/public';
import type { Database } from '$lib/supabase';

export function createSupabaseBrowserClient(
	serverAccessToken?: string
): ReturnType<typeof createBrowserClient<Database>> {
	return createBrowserClient<Database>(env.PUBLIC_SUPABASE_URL!, env.PUBLIC_SUPABASE_ANON_KEY!, {
		global: {
			headers: serverAccessToken ? { Authorization: `Bearer ${serverAccessToken}` } : {}
		},
		isSingleton: true
	});
}
