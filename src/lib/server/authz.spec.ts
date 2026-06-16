import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authorize, requirePermission } from './authz';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

interface TableFixtures {
	user_role_assignments?: { user_id: string; role_id: number; revoked_at: string | null }[];
	role_permissions?: { role_id: number; permission_key: string }[];
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	delete process.env.PERMISSION_ENGINE;
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('authorize()', () => {
	it('returns allowed=false when user is not signed in', async () => {
		const sb = createSupabaseFake({});
		const event = createEventFake(sb);
		event.locals.getUser = vi.fn(async () => null);

		const r = await authorize(event, 'denial.read');
		expect(r.allowed).toBe(false);
		expect(r.permissionSource).toBe('none');
	});

	it('grants when role_permissions has the canonical key', async () => {
		const sb = createSupabaseFake({
			user_role_assignments: [{ user_id: USER_ID, role_id: 7, revoked_at: null }],
			role_permissions: [{ role_id: 7, permission_key: 'denial.read' }]
		});
		const event = createEventFake(sb);

		const r = await authorize(event, 'denial.read');
		expect(r.allowed).toBe(true);
		expect(r.permissionSource).toBe('new');
		expect(r.roleIds).toEqual([7]);
	});

	it('denies when role_permissions does not contain the key', async () => {
		const sb = createSupabaseFake({
			user_role_assignments: [{ user_id: USER_ID, role_id: 7, revoked_at: null }],
			role_permissions: [{ role_id: 7, permission_key: 'patient.read' }]
		});
		const event = createEventFake(sb);

		const r = await authorize(event, 'denial.read');
		expect(r.allowed).toBe(false);
		expect(r.permissionSource).toBe('none');
	});

	it('denies when user has no active role assignments', async () => {
		const sb = createSupabaseFake({
			user_role_assignments: [],
			role_permissions: [{ role_id: 7, permission_key: 'denial.read' }]
		});
		const event = createEventFake(sb);

		const r = await authorize(event, 'denial.read');
		expect(r.allowed).toBe(false);
	});

	it('does NOT grant admin permissions from the legacy admin key (legacy paths removed)', async () => {
		// Even if a user somehow still has roles.permissions={admin:true} in DB,
		// authorize() no longer reads that column - only role_permissions is consulted.
		const sb = createSupabaseFake({
			user_role_assignments: [],
			role_permissions: []
		});
		const event = createEventFake(sb);

		const r = await authorize(event, 'break_glass.admin');
		expect(r.allowed).toBe(false);
	});
});

describe('requirePermission()', () => {
	it('returns the result on success', async () => {
		const sb = createSupabaseFake({
			user_role_assignments: [{ user_id: USER_ID, role_id: 1, revoked_at: null }],
			role_permissions: [{ role_id: 1, permission_key: 'denial.read' }]
		});
		const event = createEventFake(sb);

		const r = await requirePermission(event, 'denial.read');
		expect(r.allowed).toBe(true);
	});

	it('throws SvelteKit 403 and emits authorization.denied to app_events on failure', async () => {
		const sb = createSupabaseFake({
			user_role_assignments: [],
			role_permissions: []
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
