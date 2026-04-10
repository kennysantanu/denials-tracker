import { describe, it, expect, vi } from 'vitest';
import {
	getPatients,
	getPatientById,
	createPatient,
	updatePatient,
	deletePatient
} from './patients';

const mockPatient = {
	id: 1,
	first_name: 'John',
	last_name: 'Doe',
	is_active: true,
	created_at: '2024-01-01T00:00:00Z'
};

function createMockSupabase(overrides: Record<string, unknown> = {}) {
	const mockChain: Record<string, ReturnType<typeof vi.fn>> = {
		select: vi.fn().mockReturnThis(),
		insert: vi.fn().mockReturnThis(),
		update: vi.fn().mockReturnThis(),
		delete: vi.fn().mockReturnThis(),
		eq: vi.fn().mockReturnThis(),
		order: vi.fn().mockReturnThis(),
		single: vi.fn().mockResolvedValue({ data: mockPatient, error: null }),
		...overrides
	};

	// order chains to itself until a second .order() returns the final result
	let orderCallCount = 0;
	mockChain.order = vi.fn().mockImplementation(() => {
		orderCallCount++;
		// getPatients calls .order() twice — second one resolves
		if (orderCallCount >= 2) {
			return Promise.resolve({ data: [mockPatient], error: null });
		}
		return mockChain;
	});

	return {
		from: vi.fn().mockReturnValue(mockChain),
		_chain: mockChain,
		_resetOrderCount: () => {
			orderCallCount = 0;
		}
	};
}

describe('getPatients', () => {
	it('filters by is_active=true by default', async () => {
		const sb = createMockSupabase();
		await getPatients(sb as any);

		expect(sb.from).toHaveBeenCalledWith('patients');
		expect(sb._chain.select).toHaveBeenCalledWith('*');
		expect(sb._chain.eq).toHaveBeenCalledWith('is_active', true);
	});

	it('includes inactive when flag is true', async () => {
		const sb = createMockSupabase();
		await getPatients(sb as any, true);

		expect(sb.from).toHaveBeenCalledWith('patients');
		expect(sb._chain.select).toHaveBeenCalledWith('*');
		expect(sb._chain.eq).not.toHaveBeenCalledWith('is_active', true);
	});
});

describe('getPatientById', () => {
	it('selects patient by id', async () => {
		const sb = createMockSupabase();
		const result = await getPatientById(sb as any, 1);

		expect(sb.from).toHaveBeenCalledWith('patients');
		expect(sb._chain.select).toHaveBeenCalledWith('*');
		expect(sb._chain.eq).toHaveBeenCalledWith('id', 1);
		expect(sb._chain.single).toHaveBeenCalled();
	});
});

describe('createPatient', () => {
	it('inserts patient data', async () => {
		const sb = createMockSupabase();
		const data = { first_name: 'Jane', last_name: 'Smith' } as any;
		const result = await createPatient(sb as any, data);

		expect(sb.from).toHaveBeenCalledWith('patients');
		expect(sb._chain.insert).toHaveBeenCalledWith(data);
		expect(sb._chain.select).toHaveBeenCalled();
		expect(sb._chain.single).toHaveBeenCalled();
	});
});

describe('updatePatient', () => {
	it('updates patient by id', async () => {
		const sb = createMockSupabase();
		const data = { first_name: 'Updated' } as any;
		const result = await updatePatient(sb as any, 1, data);

		expect(sb.from).toHaveBeenCalledWith('patients');
		expect(sb._chain.update).toHaveBeenCalledWith(data);
		expect(sb._chain.eq).toHaveBeenCalledWith('id', 1);
		expect(sb._chain.single).toHaveBeenCalled();
	});
});

describe('deletePatient', () => {
	it('deletes patient by id', async () => {
		const sb = createMockSupabase();
		await deletePatient(sb as any, 1);

		expect(sb.from).toHaveBeenCalledWith('patients');
		expect(sb._chain.delete).toHaveBeenCalled();
		expect(sb._chain.eq).toHaveBeenCalledWith('id', 1);
	});
});
