import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '$lib/supabase';

interface AuditLogEntry {
	userId: string | null;
	action: string;
	resourceType: string;
	resourceId?: string | null;
	details?: Record<string, unknown>;
	request?: Request;
}

/**
 * Non-blocking audit log writer. Failures are logged to console but never break user flows.
 */
export function logAudit(
	supabase: SupabaseClient<Database>,
	userId: string | null,
	action: string,
	resourceType: string,
	resourceId?: string | null,
	details?: Record<string, unknown>,
	request?: Request
): void {
	insertAuditLog(supabase, {
		userId,
		action,
		resourceType,
		resourceId,
		details,
		request
	}).catch((err) => {
		console.error('[audit] Failed to write audit log entry:', err);
	});
}

async function insertAuditLog(
	supabase: SupabaseClient<Database>,
	entry: AuditLogEntry
): Promise<void> {
	let ipAddress: string | null = null;
	let userAgent: string | null = null;

	if (entry.request) {
		ipAddress =
			entry.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
			entry.request.headers.get('x-real-ip') ??
			null;
		userAgent = entry.request.headers.get('user-agent');
	}

	const { error } = await supabase.from('audit_log').insert({
		user_id: entry.userId,
		action: entry.action,
		resource_type: entry.resourceType,
		resource_id: entry.resourceId ?? null,
		ip_address: ipAddress,
		user_agent: userAgent,
		details: (entry.details as Json) ?? null
	});

	if (error) {
		throw error;
	}
}
