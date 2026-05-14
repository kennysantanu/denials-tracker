/**
 * Phase 0 - Legacy permission key freeze list.
 *
 * This array is the snapshot of legacy permission keys allowed in the
 * pre-overhaul codebase. The drift-prevention test in
 * `src/lib/types.spec.ts` asserts that `Permission` (from `./types`) is
 * exactly this set. Adding a new legacy key here is intentional drift and
 * should be avoided during the permission overhaul - new permissions must
 * use the canonical dotted naming and live in `permission_catalog`.
 */
export const LEGACY_PERMISSION_KEYS = [
	'view_denials',
	'create_denial',
	'update_denial',
	'delete_denial',
	'view_reports',
	'export_reports',
	'manage_patients',
	'manage_insurances',
	'generate_summary',
	'generate_appeal',
	'manage_users',
	'manage_roles',
	'manage_labels',
	'audit_read',
	'file_upload',
	'file_edit',
	'file_delete',
	'admin'
] as const;

export type LegacyPermissionKey = (typeof LEGACY_PERMISSION_KEYS)[number];
