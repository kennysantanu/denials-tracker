import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

/**
 * Returns the Supabase URL to use for server-side (SSR / admin) requests.
 *
 * In bundled-docker deployments, the value baked into the browser bundle
 * (`PUBLIC_SUPABASE_URL`, e.g. `http://localhost:8000`) is the host-facing URL
 * the user's browser hits — but from inside the app container, that URL
 * resolves to the container itself. Set `SUPABASE_INTERNAL_URL` to the
 * docker-network address (e.g. `http://kong:8000`) and SSR will use it
 * for outbound API calls. When unset, behavior is unchanged.
 */
export function getServerSupabaseUrl(): string {
	return env.SUPABASE_INTERNAL_URL || PUBLIC_SUPABASE_URL!;
}
