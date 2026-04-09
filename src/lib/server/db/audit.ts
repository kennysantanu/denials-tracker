import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '$lib/supabase';

type AuditLogInsert = Database['public']['Tables']['audit_log']['Insert'];

interface AuditLogFilters {
	userId?: string;
	action?: string;
	resourceType?: string;
	startDate?: string;
	endDate?: string;
}

interface GetAuditLogsParams {
	page?: number;
	pageSize?: number;
	filters?: AuditLogFilters;
}

export async function getAuditLogs(
	supabase: SupabaseClient<Database>,
	params: GetAuditLogsParams = {}
) {
	const { page = 1, pageSize = 25, filters } = params;
	const from = (page - 1) * pageSize;
	const to = from + pageSize - 1;

	let query = supabase
		.from('audit_log')
		.select('*', { count: 'exact' })
		.order('created_at', { ascending: false })
		.range(from, to);

	if (filters?.userId) {
		query = query.eq('user_id', filters.userId);
	}
	if (filters?.action) {
		query = query.eq('action', filters.action);
	}
	if (filters?.resourceType) {
		query = query.eq('resource_type', filters.resourceType);
	}
	if (filters?.startDate) {
		query = query.gte('created_at', filters.startDate);
	}
	if (filters?.endDate) {
		query = query.lte('created_at', filters.endDate);
	}

	const { data, count, error } = await query;
	return { data, count, error };
}

export function insertAuditLog(
	supabase: SupabaseClient<Database>,
	entry: {
		user_id: string | null;
		action: string;
		resource_type: string;
		resource_id?: string | null;
		ip_address?: string | null;
		user_agent?: string | null;
		details?: Record<string, unknown> | null;
	}
) {
	return supabase
		.from('audit_log')
		.insert({
			user_id: entry.user_id,
			action: entry.action,
			resource_type: entry.resource_type,
			resource_id: entry.resource_id ?? null,
			ip_address: entry.ip_address ?? null,
			user_agent: entry.user_agent ?? null,
			details: (entry.details as Json) ?? null
		})
		.select()
		.single();
}
