import type { SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: SupabaseClient<Database>;
			getUser(): Promise<User | null>;
			session: Session | null;
			/**
			 * Per-request UUID. Set by hooks.server.ts and used to correlate
			 * `audit_log` and `app_events` rows for a single request.
			 */
			requestId: string;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
