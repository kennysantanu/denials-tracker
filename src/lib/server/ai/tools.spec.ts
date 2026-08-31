import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	executeToolCall,
	getVisibleToolDefinitions,
	toolRegistry,
	type ToolContext,
	type ToolExecutionData
} from './tools';
import { logAppEvent } from '../appEvents';

vi.mock('../appEvents', () => ({ logAppEvent: vi.fn() }));

const mockLogAppEvent = vi.mocked(logAppEvent);

// ---------------------------------------------------------------------------
// Mock Supabase: a minimal thenable query chain per table that records every
// call so tests can assert exactly which tables/filters were touched.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

interface RecordedCall {
	table: string;
	method: string;
	args: unknown[];
}

const PATIENT_PERMISSIONS = ['ai.chat', 'patient.read'];
const DENIAL_PERMISSIONS = ['ai.chat', 'ai.query_denials', 'denial.read'];

function createMockSupabase(options: {
	roleIds?: number[];
	grantedPermissions?: string[];
	tables?: Record<string, Row[]>;
}) {
	const calls: RecordedCall[] = [];
	const roleIds = options.roleIds ?? [1];
	const granted = options.grantedPermissions ?? [];
	const tables = options.tables ?? {};

	function rowsFor(table: string): Row[] {
		if (table === 'user_role_assignments') {
			return roleIds.map((role_id) => ({ role_id, user_id: 'user-1', revoked_at: null }));
		}
		if (table === 'role_permissions') {
			return granted.map((permission_key) => ({
				permission_key,
				role_id: roleIds[0] ?? 1
			}));
		}
		return tables[table] ?? [];
	}

	function makeChain(table: string) {
		let filtered = rowsFor(table);
		let limitValue: number | null = null;

		const record = (method: string, args: unknown[]) => calls.push({ table, method, args });
		const applyLimit = () => (limitValue === null ? filtered : filtered.slice(0, limitValue));

		const chain: Record<string, unknown> = {};
		chain.select = (...args: unknown[]) => {
			record('select', args);
			return chain;
		};
		chain.order = (...args: unknown[]) => {
			record('order', args);
			return chain;
		};
		chain.eq = (col: string, val: unknown) => {
			record('eq', [col, val]);
			filtered = filtered.filter((r) => r[col] === val);
			return chain;
		};
		chain.gte = (col: string, val: unknown) => {
			record('gte', [col, val]);
			filtered = filtered.filter((r) => (r[col] as string) >= (val as string));
			return chain;
		};
		chain.lte = (col: string, val: unknown) => {
			record('lte', [col, val]);
			filtered = filtered.filter((r) => (r[col] as string) <= (val as string));
			return chain;
		};
		chain.in = (col: string, vals: unknown[]) => {
			record('in', [col, vals]);
			filtered = filtered.filter((r) => vals.includes(r[col]));
			return chain;
		};
		chain.is = (col: string, val: unknown) => {
			record('is', [col, val]);
			filtered = filtered.filter((r) => r[col] === val);
			return chain;
		};
		chain.or = (clause: string) => {
			record('or', [clause]);
			return chain;
		};
		chain.limit = (n: number) => {
			record('limit', [n]);
			limitValue = n;
			return chain;
		};
		chain.single = () => {
			record('single', []);
			return Promise.resolve({ data: applyLimit()[0] ?? null, error: null });
		};
		chain.maybeSingle = () => {
			record('maybeSingle', []);
			return Promise.resolve({ data: applyLimit()[0] ?? null, error: null });
		};
		chain.then = (onFulfilled: unknown, onRejected: unknown) =>
			Promise.resolve({ data: applyLimit(), error: null }).then(
				onFulfilled as never,
				onRejected as never
			);
		return chain;
	}

	return {
		from: (table: string) => makeChain(table),
		calls
	};
}

type MockSupabase = ReturnType<typeof createMockSupabase>;

function makeCtx(sb: MockSupabase): ToolContext {
	return {
		supabase: sb as unknown as ToolContext['supabase'],
		userId: 'user-1',
		requestId: 'req-1'
	};
}

function callsToTable(sb: MockSupabase, table: string): RecordedCall[] {
	return sb.calls.filter((c) => c.table === table);
}

function lastAudit() {
	return mockLogAppEvent.mock.calls.at(-1)?.[1];
}

function visibleToolNames(permissions: Record<string, boolean>): string[] {
	return getVisibleToolDefinitions(permissions).map((tool) =>
		tool.type === 'function' ? tool.function.name : tool.type
	);
}

beforeEach(() => {
	mockLogAppEvent.mockClear();
});

afterEach(() => {
	delete toolRegistry['__test_big'];
	delete toolRegistry['__test_slow'];
	delete toolRegistry['__test_broken'];
	vi.useRealTimers();
	vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------

describe('getVisibleToolDefinitions', () => {
	it('exposes nothing without permissions', () => {
		expect(getVisibleToolDefinitions({})).toEqual([]);
		expect(getVisibleToolDefinitions({ 'ai.chat': true })).toEqual([]);
	});

	it('exposes search_patients only with the full composite', () => {
		expect(visibleToolNames({ 'ai.chat': true, 'patient.read': true })).toEqual([
			'search_patients'
		]);
	});

	it('exposes search_denials only with ai.chat + ai.query_denials + denial.read', () => {
		expect(visibleToolNames({ 'ai.chat': true, 'denial.read': true })).toEqual([]);

		expect(
			visibleToolNames({
				'ai.chat': true,
				'ai.query_denials': true,
				'denial.read': true,
				'patient.read': true
			})
		).toEqual(['search_patients', 'search_denials']);
	});
});

describe('executeToolCall: unknown and unauthorized calls perform no data query', () => {
	it('rejects unknown tool names without touching the database', async () => {
		const sb = createMockSupabase({ grantedPermissions: PATIENT_PERMISSIONS });
		const result = await executeToolCall(makeCtx(sb), 'drop_table', '{}');

		expect(result).toContain('Unknown tool');
		expect(sb.calls).toHaveLength(0);
		expect(lastAudit()).toEqual(
			expect.objectContaining({
				eventName: 'ai.tool_call',
				outcome: 'denied',
				metadata: expect.objectContaining({ tool: 'drop_table', reason: 'unknown_tool' })
			})
		);
	});

	it('denies a tool when a required permission is missing', async () => {
		const sb = createMockSupabase({ grantedPermissions: ['ai.chat'] });
		const result = await executeToolCall(makeCtx(sb), 'search_patients', '{"patient_id": 1}');

		expect(result).toContain('Not authorized');
		// Only the reauthorization lookups ran — never the patients table.
		expect(callsToTable(sb, 'patients')).toHaveLength(0);
		expect(lastAudit()).toEqual(
			expect.objectContaining({
				outcome: 'denied',
				permissionKey: 'patient.read',
				metadata: expect.objectContaining({ reason: 'missing_permission' })
			})
		);
	});

	it('denies when the user has no role assignments', async () => {
		const sb = createMockSupabase({ roleIds: [], grantedPermissions: PATIENT_PERMISSIONS });
		const result = await executeToolCall(makeCtx(sb), 'search_denials', '{"denial_id": 5}');

		expect(result).toContain('Not authorized');
		expect(callsToTable(sb, 'denials')).toHaveLength(0);
	});

	it('denies search_denials without ai.query_denials even when denial.read is held', async () => {
		const sb = createMockSupabase({ grantedPermissions: ['ai.chat', 'denial.read'] });
		const result = await executeToolCall(makeCtx(sb), 'search_denials', '{"denial_id": 5}');

		expect(result).toContain('Not authorized');
		expect(callsToTable(sb, 'denials')).toHaveLength(0);
		expect(lastAudit()).toEqual(
			expect.objectContaining({ outcome: 'denied', permissionKey: 'ai.query_denials' })
		);
	});
});

describe('executeToolCall: argument validation performs no data query', () => {
	it('rejects malformed JSON', async () => {
		const sb = createMockSupabase({ grantedPermissions: PATIENT_PERMISSIONS });
		const result = await executeToolCall(makeCtx(sb), 'search_patients', '{not json');

		expect(result).toContain('not valid JSON');
		expect(callsToTable(sb, 'patients')).toHaveLength(0);
		expect(lastAudit()).toEqual(
			expect.objectContaining({
				outcome: 'failed',
				metadata: expect.objectContaining({ reason: 'validation_error' })
			})
		);
	});

	it('rejects unknown properties (strict schema)', async () => {
		const sb = createMockSupabase({ grantedPermissions: PATIENT_PERMISSIONS });
		const result = await executeToolCall(
			makeCtx(sb),
			'search_patients',
			'{"patient_id": 1, "sql": "drop table patients"}'
		);

		expect(result).toContain('Invalid tool arguments');
		expect(callsToTable(sb, 'patients')).toHaveLength(0);
	});

	it('rejects search_patients without any lookup key', async () => {
		const sb = createMockSupabase({ grantedPermissions: PATIENT_PERMISSIONS });
		const result = await executeToolCall(makeCtx(sb), 'search_patients', '{}');

		expect(result).toContain('Provide at least one of patient_id, name, or date_of_birth');
		expect(callsToTable(sb, 'patients')).toHaveLength(0);
	});

	it('rejects non-positive and unsafe IDs', async () => {
		const sb = createMockSupabase({ grantedPermissions: DENIAL_PERMISSIONS });

		expect(await executeToolCall(makeCtx(sb), 'search_denials', '{"denial_id": -3}')).toContain(
			'Invalid tool arguments'
		);
		expect(await executeToolCall(makeCtx(sb), 'search_denials', '{"denial_id": 1.5}')).toContain(
			'Invalid tool arguments'
		);
		expect(callsToTable(sb, 'denials')).toHaveLength(0);
	});

	it('rejects oversized limits', async () => {
		const sb = createMockSupabase({ grantedPermissions: PATIENT_PERMISSIONS });
		const result = await executeToolCall(
			makeCtx(sb),
			'search_patients',
			'{"patient_id": 1, "limit": 99}'
		);

		expect(result).toContain('Invalid tool arguments');
	});

	it('rejects invalid calendar dates', async () => {
		const sb = createMockSupabase({ grantedPermissions: PATIENT_PERMISSIONS });
		const result = await executeToolCall(
			makeCtx(sb),
			'search_patients',
			'{"date_of_birth": "2026-13-40"}'
		);

		expect(result).toContain('Invalid tool arguments');
	});

	it('rejects an unfiltered denial dump', async () => {
		const sb = createMockSupabase({ grantedPermissions: DENIAL_PERMISSIONS });
		const result = await executeToolCall(makeCtx(sb), 'search_denials', '{}');

		expect(result).toContain('Provide denial_id or at least one filter');
		expect(callsToTable(sb, 'denials')).toHaveLength(0);
	});

	it('rejects reversed date ranges', async () => {
		const sb = createMockSupabase({ grantedPermissions: DENIAL_PERMISSIONS });
		const result = await executeToolCall(
			makeCtx(sb),
			'search_denials',
			'{"follow_up_from": "2026-02-01", "follow_up_to": "2026-01-01"}'
		);

		expect(result).toContain('follow_up_from must be on or before follow_up_to');
		expect(callsToTable(sb, 'denials')).toHaveLength(0);
	});
});

describe('search_patients', () => {
	const patientRow = {
		id: 7,
		first_name: 'Jane',
		last_name: 'Smith',
		date_of_birth: '1980-04-12',
		is_active: true,
		note: 'must never be returned'
	};

	it('returns only disambiguation fields with explicit select and deterministic sort', async () => {
		const sb = createMockSupabase({
			grantedPermissions: PATIENT_PERMISSIONS,
			tables: { patients: [patientRow] }
		});
		const result = JSON.parse(
			await executeToolCall(makeCtx(sb), 'search_patients', '{"name": "Smith"}')
		);

		expect(result.count).toBe(1);
		expect(result.patients[0]).toEqual({
			patient_id: 7,
			name: 'Jane Smith',
			date_of_birth: '1980-04-12',
			is_active: true
		});
		expect(result.retrieved_at).toEqual(expect.any(String));

		const patientCalls = callsToTable(sb, 'patients');
		expect(patientCalls.find((c) => c.method === 'select')?.args[0]).toBe(
			'id, first_name, last_name, date_of_birth, is_active'
		);
		expect(
			patientCalls.some((c) => c.method === 'eq' && c.args[0] === 'is_active' && c.args[1] === true)
		).toBe(true);
		expect(
			patientCalls.some(
				(c) => c.method === 'or' && c.args[0] === 'first_name.ilike.%Smith%,last_name.ilike.%Smith%'
			)
		).toBe(true);
		expect(lastAudit()).toEqual(
			expect.objectContaining({ outcome: 'success', count: 1, subjectPatientId: 7 })
		);
	});

	it('sanitizes PostgREST/LIKE-special characters out of name tokens', async () => {
		const sb = createMockSupabase({ grantedPermissions: PATIENT_PERMISSIONS });
		await executeToolCall(makeCtx(sb), 'search_patients', '{"name": "Smi,th (John) %_"}');

		const orClauses = callsToTable(sb, 'patients')
			.filter((c) => c.method === 'or')
			.map((c) => c.args[0]);
		expect(orClauses).toEqual([
			'first_name.ilike.%Smi%,last_name.ilike.%Smi%',
			'first_name.ilike.%th%,last_name.ilike.%th%',
			'first_name.ilike.%John%,last_name.ilike.%John%'
		]);
	});

	it('includes inactive patients only when requested', async () => {
		const sb = createMockSupabase({ grantedPermissions: PATIENT_PERMISSIONS });
		await executeToolCall(
			makeCtx(sb),
			'search_patients',
			'{"patient_id": 7, "include_inactive": true}'
		);

		const patientCalls = callsToTable(sb, 'patients');
		expect(patientCalls.some((c) => c.method === 'eq' && c.args[0] === 'is_active')).toBe(false);
		expect(
			patientCalls.some((c) => c.method === 'eq' && c.args[0] === 'id' && c.args[1] === 7)
		).toBe(true);
	});

	it('returns a neutral empty result when nothing matches', async () => {
		const sb = createMockSupabase({ grantedPermissions: PATIENT_PERMISSIONS });
		const result = JSON.parse(
			await executeToolCall(makeCtx(sb), 'search_patients', '{"patient_id": 999}')
		);

		expect(result.patients).toEqual([]);
		expect(result.count).toBe(0);
	});
});

describe('search_denials: exact detail lookup', () => {
	const denialRow = {
		id: 42,
		patient_id: 7,
		service_start_date: '2026-01-10',
		service_end_date: '2026-01-10',
		billed_amount: 1200,
		paid_amount: 0,
		is_closed: false,
		follow_up_date: '2026-09-01',
		created_at: '2026-01-15T00:00:00Z'
	};

	function detailMock(noteCount: number) {
		return createMockSupabase({
			grantedPermissions: DENIAL_PERMISSIONS,
			tables: {
				denials: [denialRow],
				notes: Array.from({ length: noteCount }, (_, i) => ({
					id: i + 1,
					denial_id: 42,
					note: i === 0 ? 'x'.repeat(600) : `note ${i + 1}`,
					created_at: `2026-02-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
					created_by: 'someone-secret'
				})),
				denials_insurances: [{ denial_id: 42, insurances: { name: 'Aetna' } }],
				denials_labels: [{ denial_id: 42, labels: { label_name: 'Timely Filing' } }],
				patients: [{ id: 7, first_name: 'Jane', last_name: 'Smith', date_of_birth: '1980-04-12' }]
			}
		});
	}

	it('returns bounded detail: payer, amounts, status, labels, truncated notes', async () => {
		const sb = detailMock(25);
		const result = JSON.parse(
			await executeToolCall(makeCtx(sb), 'search_denials', '{"denial_id": 42}')
		);

		expect(result.available).toBe(true);
		expect(result.denial.id).toBe(42);
		expect(result.denial.is_closed).toBe(false);
		expect(result.patient).toEqual({
			patient_id: 7,
			name: 'Jane Smith',
			date_of_birth: '1980-04-12'
		});
		expect(result.insurances).toEqual(['Aetna']);
		expect(result.labels).toEqual(['Timely Filing']);

		// Notes capped at 20, each truncated to 500 chars, no author column leaked.
		expect(result.notes).toHaveLength(20);
		expect(result.notes_omitted).toBe(true);
		expect(result.notes[0].note).toHaveLength(501); // 500 chars + ellipsis
		expect(result.notes[0]).not.toHaveProperty('created_by');
		expect(result.retrieved_at).toEqual(expect.any(String));

		const denialCalls = callsToTable(sb, 'denials');
		expect(denialCalls.find((c) => c.method === 'select')?.args[0]).not.toContain('*');
		expect(lastAudit()).toEqual(
			expect.objectContaining({
				outcome: 'success',
				count: 1,
				subjectDenialId: 42,
				subjectPatientId: 7
			})
		);
	});

	it('returns the same neutral response for missing or inaccessible denials', async () => {
		const sb = createMockSupabase({ grantedPermissions: DENIAL_PERMISSIONS });
		const result = JSON.parse(
			await executeToolCall(makeCtx(sb), 'search_denials', '{"denial_id": 404}')
		);

		expect(result.available).toBe(false);
		expect(result.message).toContain('No accessible denial');
		expect(callsToTable(sb, 'notes')).toHaveLength(0);
	});
});

describe('search_denials: filtered list', () => {
	function listRows(count: number) {
		return Array.from({ length: count }, (_, i) => ({
			id: i + 1,
			patient_id: 7,
			service_start_date: '2026-01-10',
			service_end_date: null,
			billed_amount: 100 + i,
			paid_amount: 0,
			is_closed: false,
			follow_up_date: '2026-09-01',
			created_at: '2026-01-15T00:00:00Z',
			patients: { first_name: 'Jane', last_name: 'Smith' }
		}));
	}

	it('caps rows at the limit and reports has_more', async () => {
		const sb = createMockSupabase({
			grantedPermissions: DENIAL_PERMISSIONS,
			tables: { denials: listRows(11) }
		});
		const result = JSON.parse(
			await executeToolCall(makeCtx(sb), 'search_denials', '{"patient_id": 7}')
		);

		expect(result.count).toBe(10);
		expect(result.has_more).toBe(true);
		expect(result.denials[0]).not.toHaveProperty('note');
		expect(result.denials[0].patient).toBe('Jane Smith');
		expect(callsToTable(sb, 'denials').find((c) => c.method === 'limit')?.args[0]).toBe(11);
	});

	it('reports has_more=false when results fit the limit', async () => {
		const sb = createMockSupabase({
			grantedPermissions: DENIAL_PERMISSIONS,
			tables: { denials: listRows(3) }
		});
		const result = JSON.parse(
			await executeToolCall(makeCtx(sb), 'search_denials', '{"patient_id": 7}')
		);

		expect(result.count).toBe(3);
		expect(result.has_more).toBe(false);
	});

	it('applies every filter through the query builder', async () => {
		const sb = createMockSupabase({ grantedPermissions: DENIAL_PERMISSIONS });
		await executeToolCall(
			makeCtx(sb),
			'search_denials',
			JSON.stringify({
				patient_id: 7,
				is_closed: false,
				follow_up_from: '2026-01-01',
				follow_up_to: '2026-01-31',
				service_from: '2025-12-01',
				service_to: '2025-12-31'
			})
		);

		const calls = callsToTable(sb, 'denials');
		const has = (method: string, col: string, val: unknown) =>
			calls.some((c) => c.method === method && c.args[0] === col && c.args[1] === val);

		expect(has('eq', 'patient_id', 7)).toBe(true);
		expect(has('eq', 'is_closed', false)).toBe(true);
		expect(has('gte', 'follow_up_date', '2026-01-01')).toBe(true);
		expect(has('lte', 'follow_up_date', '2026-01-31')).toBe(true);
		expect(has('gte', 'service_start_date', '2025-12-01')).toBe(true);
		expect(has('lte', 'service_start_date', '2025-12-31')).toBe(true);
	});
});

describe('executeToolCall: limits and failures', () => {
	const passthroughSchema = {
		safeParse: (data: unknown) => ({ success: true as const, data })
	};

	it('truncates oversized results at maxResultChars', async () => {
		toolRegistry['__test_big'] = {
			name: '__test_big',
			description: 'test',
			parameters: {},
			schema: passthroughSchema,
			requiredPermissions: [],
			timeoutMs: 1_000,
			maxResultChars: 50,
			execute: async () => ({ data: { text: 'x'.repeat(500) }, meta: { rowCount: 1 } })
		};

		const sb = createMockSupabase({});
		const result = await executeToolCall(makeCtx(sb), '__test_big', '{}');

		expect(result.endsWith('…[truncated]')).toBe(true);
		expect(lastAudit()).toEqual(
			expect.objectContaining({
				outcome: 'success',
				metadata: expect.objectContaining({ reason: 'result_truncated', resultChars: 62 })
			})
		);
	});

	it('times out long-running tools with a safe error', async () => {
		vi.useFakeTimers();
		toolRegistry['__test_slow'] = {
			name: '__test_slow',
			description: 'test',
			parameters: {},
			schema: passthroughSchema,
			requiredPermissions: [],
			timeoutMs: 50,
			maxResultChars: 1_000,
			execute: () => new Promise<ToolExecutionData>(() => {})
		};

		const sb = createMockSupabase({});
		const promise = executeToolCall(makeCtx(sb), '__test_slow', '{}');
		await vi.advanceTimersByTimeAsync(100);
		const result = await promise;

		expect(result).toContain('took too long');
		expect(lastAudit()).toEqual(
			expect.objectContaining({
				outcome: 'failed',
				metadata: expect.objectContaining({ reason: 'timeout' })
			})
		);
	});

	it('returns a safe generic error when a handler throws', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		toolRegistry['__test_broken'] = {
			name: '__test_broken',
			description: 'test',
			parameters: {},
			schema: passthroughSchema,
			requiredPermissions: [],
			timeoutMs: 1_000,
			maxResultChars: 1_000,
			execute: async () => {
				throw new Error('boom with internal detail');
			}
		};

		const sb = createMockSupabase({});
		const result = await executeToolCall(makeCtx(sb), '__test_broken', '{}');

		expect(result).toBe('{"error":"The tool failed to complete."}');
		expect(result).not.toContain('boom');
		expect(lastAudit()).toEqual(
			expect.objectContaining({
				outcome: 'failed',
				metadata: expect.objectContaining({ reason: 'internal_error' })
			})
		);
	});
});
