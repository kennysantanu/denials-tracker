import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '$lib/supabase';
import type { PermissionSource } from './authz';

export interface AppEventEntry {
	eventName: string;
	featureArea: string;
	outcome: 'success' | 'denied' | 'failed';
	actorUserId?: string | null;
	actorRoleIds?: number[] | null;
	permissionKey?: string | null;
	permissionSource?: PermissionSource | null;
	resourceType?: string | null;
	resourceId?: string | null;
	subjectPatientId?: number | null;
	subjectDenialId?: number | null;
	requestId?: string | null;
	sessionId?: string | null;
	durationMs?: number | null;
	count?: number | null;
	metadata?: Record<string, unknown> | null;
}

/**
 * Non-blocking app_events writer. Mirrors the audit.ts pattern:
 * failures are logged to the console but never break the calling flow.
 *
 * `app_events` is the KPI/analytics stream. `audit_log` remains the HIPAA
 * compliance trail. Both share a `request_id` so a single request can be
 * correlated across both streams.
 */
export function logAppEvent(supabase: SupabaseClient<Database>, entry: AppEventEntry): void {
	insertAppEvent(supabase, entry).catch((err) => {
		console.error('[app_events] Failed to write event:', err);
	});
}

async function insertAppEvent(
	supabase: SupabaseClient<Database>,
	entry: AppEventEntry
): Promise<void> {
	const { error } = await supabase.from('app_events').insert({
		event_name: entry.eventName,
		feature_area: entry.featureArea,
		outcome: entry.outcome,
		actor_user_id: entry.actorUserId ?? null,
		actor_role_ids: entry.actorRoleIds ?? [],
		permission_key: entry.permissionKey ?? null,
		permission_source: entry.permissionSource ?? 'none',
		resource_type: entry.resourceType ?? null,
		resource_id: entry.resourceId ?? null,
		subject_patient_id: entry.subjectPatientId ?? null,
		subject_denial_id: entry.subjectDenialId ?? null,
		request_id: entry.requestId ?? null,
		session_id: entry.sessionId ?? null,
		duration_ms: entry.durationMs ?? null,
		count: entry.count ?? null,
		metadata: (entry.metadata as Json) ?? {}
	});

	if (error) throw error;
}
