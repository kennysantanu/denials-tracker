import { describe, it, expect } from 'vitest';
import { hasPermission, type Permission } from './types';

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
