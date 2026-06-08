import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { getServerSupabaseUrl } from '$lib/server/supabaseUrl';
import type { Database, Json } from '$lib/supabase';

interface AuditLogEntry {
	userId: string | null;
	action: string;
	resourceType: string;
	resourceId?: string | null;
	details?: Record<string, unknown>;
	request?: Request;
	ipAddress?: string | null;
}

let auditClient: SupabaseClient<Database> | null = null;

export function getAuditSupabaseClient(
	fallbackClient: SupabaseClient<Database>
): SupabaseClient<Database> {
	if (!env.SUPABASE_SERVICE_ROLE_KEY) return fallbackClient;

	if (!auditClient) {
		auditClient = createClient<Database>(getServerSupabaseUrl(), env.SUPABASE_SERVICE_ROLE_KEY, {
			auth: { persistSession: false, autoRefreshToken: false }
		});
	}

	return auditClient;
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
	request?: Request,
	ipAddress?: string | null
): void {
	insertAuditLog(supabase, {
		userId,
		action,
		resourceType,
		resourceId,
		details,
		request,
		ipAddress
	}).catch((err) => {
		console.error('[audit] Failed to write audit log entry:', err);
	});
}

async function insertAuditLog(
	supabase: SupabaseClient<Database>,
	entry: AuditLogEntry
): Promise<void> {
	let ipAddress: string | null = entry.ipAddress ?? null;
	let userAgent: string | null = null;

	if (entry.request) {
		ipAddress =
			ipAddress ??
			entry.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
			entry.request.headers.get('x-real-ip') ??
			null;
		userAgent = entry.request.headers.get('user-agent');
	}

	const { error } = await getAuditSupabaseClient(supabase)
		.from('audit_log')
		.insert({
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
