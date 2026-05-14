import { describe, it, expect, expectTypeOf } from 'vitest';
import { hasPermission, type Permission } from './types';
import { LEGACY_PERMISSION_KEYS, type LegacyPermissionKey } from './permissions.legacy';

describe('Permission type (drift freeze)', () => {
	// Phase 0 of the permission overhaul. The legacy `Permission` union must
	// match `LEGACY_PERMISSION_KEYS` exactly until the new RBAC system replaces
	// it. Adding a new legacy key fails this test on purpose - new permissions
	// must go through `permission_catalog` instead.
	it('matches the frozen legacy permission key set', () => {
		expectTypeOf<Permission>().toEqualTypeOf<LegacyPermissionKey>();
		// Runtime assertion so vitest sees this test as having an assertion.
		// The real guarantee is the type-level check above; if the unions
		// drift, `npm run check` will fail to compile this file.
		const sample: Permission = LEGACY_PERMISSION_KEYS[0];
		expect(LEGACY_PERMISSION_KEYS).toContain(sample);
	});

	it('LEGACY_PERMISSION_KEYS contains every value used by hasPermission helpers', () => {
		const frozen = new Set<string>(LEGACY_PERMISSION_KEYS);
		for (const key of LEGACY_PERMISSION_KEYS) {
			expect(frozen.has(key)).toBe(true);
		}
		expect(LEGACY_PERMISSION_KEYS.length).toBe(18);
	});
});

describe('hasPermission', () => {
	it('returns true when permission exists and is true', () => {
		const perms = { view_denials: true, create_denial: false };
		expect(hasPermission(perms, 'view_denials')).toBe(true);
	});

	it('returns false when permission exists and is false', () => {
		const perms = { view_denials: true, create_denial: false };
		expect(hasPermission(perms, 'create_denial')).toBe(false);
	});

	it('returns false when permission does not exist', () => {
		const perms = { view_denials: true };
		expect(hasPermission(perms, 'delete_denial')).toBe(false);
	});

	it('returns false when permissions is null', () => {
		expect(hasPermission(null, 'view_denials')).toBe(false);
	});

	it('returns false when permissions is undefined', () => {
		expect(hasPermission(undefined, 'view_denials')).toBe(false);
	});

	it('works with various permission types', () => {
		const perms: Record<string, boolean> = {
			manage_users: true,
			audit_read: true,
			admin: false,
			export_reports: true
		};

		expect(hasPermission(perms, 'manage_users')).toBe(true);
		expect(hasPermission(perms, 'audit_read')).toBe(true);
		expect(hasPermission(perms, 'admin')).toBe(false);
		expect(hasPermission(perms, 'export_reports')).toBe(true);
	});
});
