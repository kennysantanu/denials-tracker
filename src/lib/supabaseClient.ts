import { createBrowserClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '$lib/supabase';

export function createSupabaseBrowserClient(
	serverAccessToken?: string
): ReturnType<typeof createBrowserClient<Database>> {
	return createBrowserClient<Database>(PUBLIC_SUPABASE_URL!, PUBLIC_SUPABASE_ANON_KEY!, {
		global: {
			headers: serverAccessToken ? { Authorization: `Bearer ${serverAccessToken}` } : {}
		},
		isSingleton: true
	});
}
