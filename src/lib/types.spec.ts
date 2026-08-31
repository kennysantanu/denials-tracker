import { describe, it, expect } from 'vitest';
import { hasPermission, type Permission } from './types';
import { LEGACY_PERMISSION_KEYS } from './permissions.legacy';

describe('Permission type (canonical)', () => {
	// Phase 5+ of the permission overhaul. `Permission` now uses canonical
	// dotted keys. Legacy keys are preserved only in `permissions.legacy.ts`
	// as a compatibility reference.
	it('LEGACY_PERMISSION_KEYS snapshot is unchanged at 18 entries', () => {
		expect(LEGACY_PERMISSION_KEYS.length).toBe(18);
	});

	it('canonical Permission values do not overlap with legacy snake_case keys', () => {
		const legacySet = new Set<string>(LEGACY_PERMISSION_KEYS);
		// A canonical key is dotted (e.g. 'denial.read'); legacy keys use underscores
		const canonicalSample: Permission = 'denial.read';
		expect(legacySet.has(canonicalSample)).toBe(false);
	});
});

describe('hasPermission', () => {
	it('returns true when permission exists and is true', () => {
		const perms = { 'denial.read': true, 'denial.create': false };
		expect(hasPermission(perms, 'denial.read')).toBe(true);
	});

	it('returns false when permission exists and is false', () => {
		const perms = { 'denial.read': true, 'denial.create': false };
		expect(hasPermission(perms, 'denial.create')).toBe(false);
	});

	it('returns false when permission does not exist', () => {
		const perms = { 'denial.read': true };
		expect(hasPermission(perms, 'denial.delete')).toBe(false);
	});

	it('returns false when permissions is null', () => {
		expect(hasPermission(null, 'denial.read')).toBe(false);
	});

	it('returns false when permissions is undefined', () => {
		expect(hasPermission(undefined, 'denial.read')).toBe(false);
	});

	it('works with various canonical permission types', () => {
		const perms: Record<string, boolean> = {
			'user.read': true,
			'audit.read': true,
			'break_glass.admin': false,
			'report.export': true
		};

		expect(hasPermission(perms, 'user.read')).toBe(true);
		expect(hasPermission(perms, 'audit.read')).toBe(true);
		expect(hasPermission(perms, 'break_glass.admin')).toBe(false);
		expect(hasPermission(perms, 'report.export')).toBe(true);
	});
});
