import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	getDenialsByPatient,
	createDenial,
	updateDenial,
	deleteDenial
} from './denials';

const mockDenial = {
	id: 1,
	patient_id: 10,
	denial_reason: 'Test reason',
	created_at: '2024-01-01T00:00:00Z'
};

function createMockSupabase(overrides: Record<string, Record<string, unknown>> = {}) {
	const defaultChain: Record<string, ReturnType<typeof vi.fn>> = {
		select: vi.fn().mockReturnThis(),
		insert: vi.fn().mockReturnThis(),
		update: vi.fn().mockReturnThis(),
		delete: vi.fn().mockReturnThis(),
		eq: vi.fn().mockReturnThis(),
		order: vi.fn().mockReturnThis(),
		single: vi.fn().mockResolvedValue({ data: mockDenial, error: null })
	};

	// Build per-table chains so different .from() calls can have different overrides
	const tableChains: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {};

	function getChain(table: string) {
		if (!tableChains[table]) {
			// Clone default chain for each table, apply overrides
			const chain: Record<string, ReturnType<typeof vi.fn>> = {};
			for (const key of Object.keys(defaultChain)) {
				chain[key] = vi.fn().mockReturnThis();
			}
			chain.single = vi.fn().mockResolvedValue({ data: mockDenial, error: null });
			chain.order = vi.fn().mockResolvedValue({ data: [mockDenial], error: null });
			if (overrides[table]) {
				Object.assign(chain, overrides[table]);
			}
			tableChains[table] = chain;
		}
		return tableChains[table];
	}

	const supabase = {
		from: vi.fn((table: string) => getChain(table)),
		_chain: (table: string) => getChain(table)
	};

	return supabase;
}

describe('getDenialsByPatient', () => {
	it('queries denials table filtered by patient_id', async () => {
		const sb = createMockSupabase();
		await getDenialsByPatient(sb as any, 10);

		expect(sb.from).toHaveBeenCalledWith('denials');
		const chain = sb._chain('denials');
		expect(chain.select).toHaveBeenCalledWith('*');
		expect(chain.eq).toHaveBeenCalledWith('patient_id', 10);
		expect(chain.order).toHaveBeenCalledWith('service_start_date', { ascending: false });
	});

	it('propagates Supabase error', async () => {
		const mockError = { message: 'db error', code: '42P01', details: '', hint: '' };
		const sb = createMockSupabase({
			denials: {
				order: vi.fn().mockResolvedValue({ data: null, error: mockError })
			}
		});

		const result = await getDenialsByPatient(sb as any, 10);
		expect(result.error).toEqual(mockError);
	});
});

describe('createDenial', () => {
	it('inserts denial and handles insurance and label junction tables', async () => {
		const sb = createMockSupabase({
			denials_insurances: {
				insert: vi.fn().mockResolvedValue({ data: null, error: null })
			},
			denials_labels: {
				insert: vi.fn().mockResolvedValue({ data: null, error: null })
			}
		});

		const data = { patient_id: 10, denial_reason: 'Test' } as any;
		const result = await createDenial(sb as any, data, [1, 2], [3]);

		expect(sb.from).toHaveBeenCalledWith('denials');
		expect(sb.from).toHaveBeenCalledWith('denials_insurances');
		expect(sb.from).toHaveBeenCalledWith('denials_labels');
		expect(result.data).toEqual(mockDenial);
		expect(result.error).toBeNull();
	});

	it('inserts denial without junction tables', async () => {
		const sb = createMockSupabase();

		const data = { patient_id: 10, denial_reason: 'Test' } as any;
		const result = await createDenial(sb as any, data);

		expect(sb.from).toHaveBeenCalledWith('denials');
		expect(sb.from).not.toHaveBeenCalledWith('denials_insurances');
		expect(sb.from).not.toHaveBeenCalledWith('denials_labels');
		expect(result.data).toEqual(mockDenial);
	});

	it('propagates error from denial insert', async () => {
		const mockError = { message: 'insert error', code: '23505', details: '', hint: '' };
		const sb = createMockSupabase({
			denials: {
				single: vi.fn().mockResolvedValue({ data: null, error: mockError })
			}
		});

		const result = await createDenial(sb as any, {} as any, [1]);
		expect(result.error).toEqual(mockError);
		expect(result.data).toBeNull();
	});

	it('propagates error from insurance junction insert', async () => {
		const mockError = { message: 'junction error', code: '23503', details: '', hint: '' };
		const sb = createMockSupabase({
			denials_insurances: {
				insert: vi.fn().mockResolvedValue({ data: null, error: mockError })
			}
		});

		const result = await createDenial(sb as any, {} as any, [1]);
		expect(result.error).toEqual(mockError);
	});
});

describe('updateDenial', () => {
	it('updates denial and manages junction tables', async () => {
		const sb = createMockSupabase({
			denials_insurances: {
				delete: vi.fn().mockReturnValue({
					eq: vi.fn().mockResolvedValue({ data: null, error: null })
				}),
				insert: vi.fn().mockResolvedValue({ data: null, error: null })
			},
			denials_labels: {
				delete: vi.fn().mockReturnValue({
					eq: vi.fn().mockResolvedValue({ data: null, error: null })
				}),
				insert: vi.fn().mockResolvedValue({ data: null, error: null })
			}
		});

		const data = { denial_reason: 'Updated' } as any;
		const result = await updateDenial(sb as any, 1, data, [5], [6]);

		expect(sb.from).toHaveBeenCalledWith('denials');
		expect(sb.from).toHaveBeenCalledWith('denials_insurances');
		expect(sb.from).toHaveBeenCalledWith('denials_labels');
		expect(result.data).toEqual(mockDenial);
		expect(result.error).toBeNull();
	});

	it('propagates error from denial update', async () => {
		const mockError = { message: 'update error', code: '42P01', details: '', hint: '' };
		const sb = createMockSupabase({
			denials: {
				single: vi.fn().mockResolvedValue({ data: null, error: mockError })
			}
		});

		const result = await updateDenial(sb as any, 1, {} as any);
		expect(result.error).toEqual(mockError);
		expect(result.data).toBeNull();
	});
});

describe('deleteDenial', () => {
	it('deletes junction rows then denial by id', async () => {
		const sb = createMockSupabase({
			denials_insurances: {
				delete: vi.fn().mockReturnValue({
					eq: vi.fn().mockResolvedValue({ data: null, error: null })
				})
			},
			denials_labels: {
				delete: vi.fn().mockReturnValue({
					eq: vi.fn().mockResolvedValue({ data: null, error: null })
				})
			},
			denials: {
				delete: vi.fn().mockReturnValue({
					eq: vi.fn().mockResolvedValue({ data: null, error: null })
				})
			}
		});

		const result = await deleteDenial(sb as any, 1);

		expect(sb.from).toHaveBeenCalledWith('denials_insurances');
		expect(sb.from).toHaveBeenCalledWith('denials_labels');
		expect(sb.from).toHaveBeenCalledWith('denials');
		expect(result.error).toBeNull();
	});

	it('propagates error from insurance junction delete', async () => {
		const mockError = { message: 'delete error', code: '42P01', details: '', hint: '' };
		const sb = createMockSupabase({
			denials_insurances: {
				delete: vi.fn().mockReturnValue({
					eq: vi.fn().mockResolvedValue({ data: null, error: mockError })
				})
			}
		});

		const result = await deleteDenial(sb as any, 1);
		expect(result.error).toEqual(mockError);
	});
});
