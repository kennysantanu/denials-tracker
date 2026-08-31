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

/**
 * Resolves the client IP for rate limiting and audit. Prefers the SvelteKit
 * adapter's getClientAddress() (sourced from the actual TCP peer, or the
 * ADDRESS_HEADER when explicitly configured) over the freely spoofable
 * X-Forwarded-For / X-Real-IP headers, falling back to those only when the
 * adapter cannot provide an address. This is the single source of truth for
 * "client IP" — keep it in sync with every audit_log writer.
 */
export function resolveClientIp(
	request: Request,
	getClientAddress?: () => string
): string | null {
	if (getClientAddress) {
		try {
			const address = getClientAddress();
			if (address) return address;
		} catch {
			// Fall through to header-based resolution.
		}
	}
	return (
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		request.headers.get('x-real-ip')
	);
}

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
		ipAddress = ipAddress ?? resolveClientIp(entry.request);
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
