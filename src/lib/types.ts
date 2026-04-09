import type { Database } from '$lib/supabase';

// --- Composite types for views with joins ---

type PatientRow = Database['public']['Tables']['patients']['Row'];
type DenialRow = Database['public']['Tables']['denials']['Row'];
type NoteRow = Database['public']['Tables']['notes']['Row'];
type InsuranceRow = Database['public']['Tables']['insurances']['Row'];
type LabelRow = Database['public']['Tables']['labels']['Row'];
type UserRow = Database['public']['Tables']['users']['Row'];
type RoleRow = Database['public']['Tables']['roles']['Row'];

export interface DenialWithRelations extends DenialRow {
	patient?: PatientRow;
	notes?: NoteRow[];
	insurances?: InsuranceRow[];
	labels?: LabelRow[];
}

export interface UserWithRole extends UserRow {
	roles?: RoleRow | null;
}

// --- Permission system ---

export type Permission =
	| 'view_denials'
	| 'create_denial'
	| 'update_denial'
	| 'delete_denial'
	| 'view_reports'
	| 'export_reports'
	| 'manage_patients'
	| 'manage_insurances'
	| 'generate_summary'
	| 'generate_appeal'
	| 'manage_users'
	| 'manage_roles'
	| 'manage_labels'
	| 'audit_read'
	| 'admin';

/**
 * Check if a permissions record contains a specific permission.
 */
export function hasPermission(
	permissions: Record<string, boolean> | null | undefined,
	required: Permission
): boolean {
	if (!permissions) return false;
	return permissions[required] === true;
}
