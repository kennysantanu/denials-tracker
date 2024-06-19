// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
import { SupabaseClient, Session } from '@supabase/supabase-js'

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient
      		safeGetSession(): Promise<{ session: Session | null; user: User | null }>
		}
		interface PageData {
			session: Session | null
      		user: User | null
		}
	}
}

export {};
