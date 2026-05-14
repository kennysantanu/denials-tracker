/**
 * Phase 5 representative 403 wiring tests.
 *
 * These tests confirm that migrated route handlers actually call
 * `requirePermission(event, <canonical key>, ...)` so that a denied user
 * receives a SvelteKit 403. The full behaviour of `requirePermission`
 * (catalog lookup, dual-engine resolution, app_events emission) is covered
 * exhaustively in `src/lib/server/authz.spec.ts`. Here we only verify the
 * route -> requirePermission wiring.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { error } from '@sveltejs/kit';

// Mock authz so we can intercept the call and force a 403.
vi.mock('$lib/server/authz', () => {
	const requirePermission = vi.fn(async (_event: unknown, _key: string) => {
		throw error(403, 'Forbidden');
	});
	const loadEffectivePermissions = vi.fn(async () => ({}) as Record<string, boolean>);
	return { requirePermission, loadEffectivePermissions };
});

// Mock heavy DB and audit deps so the load functions don't try real I/O.
vi.mock('$lib/server/db/patients', () => ({
	getPatientsPaginated: vi.fn(async () => ({ data: [], total: 0, error: null })),
	getPatientById: vi.fn(async () => ({ data: null, error: null }))
}));
vi.mock('$lib/server/audit', () => ({ logAudit: vi.fn() }));

import { requirePermission } from '$lib/server/authz';

function makeEvent(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		locals: {
			supabase: {} as any,
			getUser: vi.fn(async () => ({ id: 'user-123' })),
			session: null,
			requestId: 'req-test'
		},
		request: new Request('http://localhost/'),
		url: new URL('http://localhost/'),
		params: {},
		fetch: vi.fn(),
		setHeaders: vi.fn(),
		cookies: {} as any,
		platform: undefined,
		isDataRequest: false,
		isSubRequest: false,
		route: { id: '/' },
		...overrides
	} as any;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('Phase 5 route 403 gating', () => {
	it('record list page requires patient.read', async () => {
		const { load } = await import('./(app)/record/+page.server');
		await expect(load(makeEvent())).rejects.toMatchObject({ status: 403 });
		expect(requirePermission).toHaveBeenCalledWith(
			expect.anything(),
			'patient.read',
			expect.objectContaining({ resourceType: 'patient' })
		);
	});

	it('audit page requires audit.read', async () => {
		const { load } = await import('./(app)/setting/admin/audit/+page.server');
		await expect(load(makeEvent())).rejects.toMatchObject({ status: 403 });
		expect(requirePermission).toHaveBeenCalledWith(
			expect.anything(),
			'audit.read',
			expect.objectContaining({ resourceType: 'audit_log' })
		);
	});

	it('report page requires report.read', async () => {
		const { load } = await import('./(app)/report/+page.server');
		await expect(load(makeEvent())).rejects.toMatchObject({ status: 403 });
		expect(requirePermission).toHaveBeenCalledWith(
			expect.anything(),
			'report.read',
			expect.objectContaining({ resourceType: 'report' })
		);
	});

	it('AI chat endpoint requires ai.chat', async () => {
		const { POST } = await import('./api/v1/ai/chat/+server');
		await expect(POST(makeEvent())).rejects.toMatchObject({ status: 403 });
		expect(requirePermission).toHaveBeenCalledWith(
			expect.anything(),
			'ai.chat',
			expect.objectContaining({ resourceType: 'ai_interaction' })
		);
	});

	it('follow-up date PATCH requires followup.update', async () => {
		const evt = makeEvent({ params: { id: '42' } });
		const { PATCH } = await import('./api/v1/denials/[id]/follow-up-date/+server');
		await expect(PATCH(evt)).rejects.toMatchObject({ status: 403 });
		expect(requirePermission).toHaveBeenCalledWith(
			expect.anything(),
			'followup.update',
			expect.objectContaining({ subjectDenialId: 42 })
		);
	});
});
