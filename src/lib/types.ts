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
	| 'denial.read'
	| 'denial.create'
	| 'denial.update'
	| 'denial.close'
	| 'denial.reopen'
	| 'denial.delete'
	| 'note.create'
	| 'note.update'
	| 'note.delete'
	| 'followup.update'
	| 'report.read'
	| 'report.export'
	| 'patient.read'
	| 'patient.create'
	| 'patient.update'
	| 'patient.archive'
	| 'insurance.read'
	| 'insurance.create'
	| 'insurance.update'
	| 'insurance.delete'
	| 'ai.summary'
	| 'ai.appeal'
	| 'ai.chat'
	| 'ai.query_denials'
	| 'wiki.read'
	| 'user.read'
	| 'user.create'
	| 'user.update'
	| 'user.delete'
	| 'role.read'
	| 'role.create'
	| 'role.update'
	| 'role.delete'
	| 'permission.read'
	| 'permission.update'
	| 'label.read'
	| 'label.create'
	| 'label.update'
	| 'label.delete'
	| 'audit.read'
	| 'audit.export'
	| 'file.read'
	| 'file.upload'
	| 'file.update'
	| 'file.delete'
	| 'kpi.read.self'
	| 'kpi.read.team'
	| 'kpi.read.all'
	| 'admin.read'
	| 'system_preferences.read'
	| 'system_preferences.update'
	| 'break_glass.admin';

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
