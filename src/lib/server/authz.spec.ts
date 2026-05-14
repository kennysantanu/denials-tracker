import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authorize, requirePermission, getPermissionEngine } from './authz';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

interface TableFixtures {
	users?: {
		id: string;
		role: number | null;
		roles: { permissions: Record<string, boolean> } | null;
	}[];
	user_role_assignments?: { user_id: string; role_id: number; revoked_at: string | null }[];
	role_permissions?: { role_id: number; permission_key: string }[];
	permission_compatibility_map?: {
		legacy_key: string;
		permission_key: string;
		direction: 'legacy_to_new' | 'new_to_legacy' | 'both';
		is_active: boolean;
	}[];
	app_events?: { event_name: string; outcome: string; permission_key: string | null }[];
}

function createSupabaseFake(fixtures: TableFixtures) {
	const inserts: Record<string, unknown[]> = {};

	function tableQuery(table: keyof TableFixtures) {
		const rows: any[] = [...((fixtures[table] as any[]) ?? [])];
		const filters: Array<(r: any) => boolean> = [];

		const builder: any = {
			select: vi.fn(() => builder),
			eq: vi.fn((col: string, val: unknown) => {
				filters.push((r) => r[col] === val);
				return builder;
			}),
			in: vi.fn((col: string, vals: unknown[]) => {
				filters.push((r) => vals.includes(r[col]));
				return builder;
			}),
			is: vi.fn((col: string, val: unknown) => {
				filters.push((r) => r[col] === val);
				return builder;
			}),
			maybeSingle: vi.fn(async () => {
				const out = rows.filter((r) => filters.every((f) => f(r)));
				return { data: out[0] ?? null, error: null };
			}),
			single: vi.fn(async () => {
				const out = rows.filter((r) => filters.every((f) => f(r)));
				return { data: out[0] ?? null, error: null };
			}),
			insert: vi.fn(async (rec: unknown) => {
				if (!inserts[table]) inserts[table] = [];
				inserts[table].push(rec);
				return { data: null, error: null };
			}),
			// Make the builder thenable so `await supabase.from('x').select(...).eq(...)`
			// resolves to the filtered list.
			then: (resolve: (v: { data: any[]; error: null }) => unknown) => {
				const out = rows.filter((r) => filters.every((f) => f(r)));
				return Promise.resolve({ data: out, error: null }).then(resolve);
			}
		};
		return builder;
	}

	return {
		from: vi.fn((table: keyof TableFixtures) => tableQuery(table)),
		_inserts: inserts
	};
}

const USER_ID = 'user-123';

function createEventFake(supabase: ReturnType<typeof createSupabaseFake>) {
	return {
		locals: {
			supabase,
			getUser: vi.fn(async () => ({ id: USER_ID })),
			session: null,
			requestId: 'req-test'
		}
	} as any;
}

const COMPAT_MAP = [
	{
		legacy_key: 'view_denials',
		permission_key: 'denial.read',
		direction: 'legacy_to_new' as const,
		is_active: true
	},
	{
		legacy_key: 'admin',
		permission_key: 'break_glass.admin',
		direction: 'both' as const,
		is_active: true
	}
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	delete process.env.PERMISSION_ENGINE;
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('getPermissionEngine', () => {
	it('defaults to dual when env unset', () => {
		expect(getPermissionEngine()).toBe('dual');
	});

	it('honors legacy', () => {
		process.env.PERMISSION_ENGINE = 'legacy';
		expect(getPermissionEngine()).toBe('legacy');
	});

	it('honors new', () => {
		process.env.PERMISSION_ENGINE = 'new';
		expect(getPermissionEngine()).toBe('new');
	});

	it('falls back to dual on unknown value', () => {
		process.env.PERMISSION_ENGINE = 'wat';
		expect(getPermissionEngine()).toBe('dual');
	});
});

describe('authorize() - dual engine (default)', () => {
	it('returns allowed=false when user is not signed in', async () => {
		const sb = createSupabaseFake({});
		const event = createEventFake(sb);
		event.locals.getUser = vi.fn(async () => null);

		const r = await authorize(event, 'denial.read');
		expect(r.allowed).toBe(false);
		expect(r.permissionSource).toBe('none');
	});

	it('grants from legacy-only when canonical key maps to a granted legacy key', async () => {
		const sb = createSupabaseFake({
			users: [{ id: USER_ID, role: 1, roles: { permissions: { view_denials: true } } }],
			user_role_assignments: [],
			role_permissions: [],
			permission_compatibility_map: COMPAT_MAP
		});
		const event = createEventFake(sb);

		const r = await authorize(event, 'denial.read');
		expect(r.allowed).toBe(true);
		expect(r.permissionSource).toBe('legacy');
	});

	it('grants from new-only when role_permissions has the canonical key', async () => {
		const sb = createSupabaseFake({
			users: [{ id: USER_ID, role: null, roles: null }],
			user_role_assignments: [{ user_id: USER_ID, role_id: 7, revoked_at: null }],
			role_permissions: [{ role_id: 7, permission_key: 'denial.read' }],
			permission_compatibility_map: COMPAT_MAP
		});
		const event = createEventFake(sb);

		const r = await authorize(event, 'denial.read');
		expect(r.allowed).toBe(true);
		expect(r.permissionSource).toBe('new');
		expect(r.roleIds).toEqual([7]);
	});

	it('reports both when legacy and new agree', async () => {
		const sb = createSupabaseFake({
			users: [{ id: USER_ID, role: 1, roles: { permissions: { view_denials: true } } }],
			user_role_assignments: [{ user_id: USER_ID, role_id: 1, revoked_at: null }],
			role_permissions: [{ role_id: 1, permission_key: 'denial.read' }],
			permission_compatibility_map: COMPAT_MAP
		});
		const event = createEventFake(sb);

		const r = await authorize(event, 'denial.read');
		expect(r.allowed).toBe(true);
		expect(r.permissionSource).toBe('both');
	});

	it('returns none when neither store grants', async () => {
		const sb = createSupabaseFake({
			users: [{ id: USER_ID, role: 1, roles: { permissions: {} } }],
			user_role_assignments: [],
			role_permissions: [],
			permission_compatibility_map: COMPAT_MAP
		});
		const event = createEventFake(sb);

		const r = await authorize(event, 'denial.read');
		expect(r.allowed).toBe(false);
		expect(r.permissionSource).toBe('none');
	});

	it('respects the admin -> break_glass.admin only mapping (admin does NOT auto-grant other admin perms)', async () => {
		const sb = createSupabaseFake({
			users: [{ id: USER_ID, role: 1, roles: { permissions: { admin: true } } }],
			user_role_assignments: [],
			role_permissions: [],
			permission_compatibility_map: COMPAT_MAP
		});
		const event = createEventFake(sb);

		const breakGlass = await authorize(event, 'break_glass.admin');
		expect(breakGlass.allowed).toBe(true);

		const userManage = await authorize(event, 'user.create');
		expect(userManage.allowed).toBe(false);
	});
});

describe('authorize() - engine flag overrides', () => {
	it('engine=legacy ignores role_permissions even when granted', async () => {
		process.env.PERMISSION_ENGINE = 'legacy';
		const sb = createSupabaseFake({
			users: [{ id: USER_ID, role: 1, roles: { permissions: {} } }],
			user_role_assignments: [{ user_id: USER_ID, role_id: 1, revoked_at: null }],
			role_permissions: [{ role_id: 1, permission_key: 'denial.read' }],
			permission_compatibility_map: COMPAT_MAP
		});
		const event = createEventFake(sb);

		const r = await authorize(event, 'denial.read');
		expect(r.allowed).toBe(false);
	});

	it('engine=new ignores legacy permissions JSON', async () => {
		process.env.PERMISSION_ENGINE = 'new';
		const sb = createSupabaseFake({
			users: [{ id: USER_ID, role: 1, roles: { permissions: { view_denials: true } } }],
			user_role_assignments: [],
			role_permissions: [],
			permission_compatibility_map: COMPAT_MAP
		});
		const event = createEventFake(sb);

		const r = await authorize(event, 'denial.read');
		expect(r.allowed).toBe(false);
	});
});

describe('requirePermission()', () => {
	it('returns the result on success', async () => {
		const sb = createSupabaseFake({
			users: [{ id: USER_ID, role: 1, roles: { permissions: { view_denials: true } } }],
			user_role_assignments: [],
			role_permissions: [],
			permission_compatibility_map: COMPAT_MAP
		});
		const event = createEventFake(sb);

		const r = await requirePermission(event, 'denial.read');
		expect(r.allowed).toBe(true);
	});

	it('throws SvelteKit 403 and emits authorization.denied to app_events on failure', async () => {
		const sb = createSupabaseFake({
			users: [{ id: USER_ID, role: 1, roles: { permissions: {} } }],
			user_role_assignments: [],
			role_permissions: [],
			permission_compatibility_map: COMPAT_MAP
		});
		const event = createEventFake(sb);

		await expect(requirePermission(event, 'denial.read')).rejects.toMatchObject({
			status: 403
		});

		// Wait a microtask so the non-blocking insert flushes.
		await new Promise((r) => setTimeout(r, 0));

		const inserted = sb._inserts.app_events ?? [];
		expect(inserted.length).toBe(1);
		expect(inserted[0]).toMatchObject({
			event_name: 'authorization.denied',
			outcome: 'denied',
			permission_key: 'denial.read'
		});
	});
});
