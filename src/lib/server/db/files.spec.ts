import { describe, it, expect, vi } from 'vitest';
import { getFileViewSiblings } from './files';

const mockSiblings = [
	{ name: '2026-07-27/EOB_1040.pdf', created_at: '2026-07-27T08:00:00Z', metadata: null },
	{ name: '2026-07-27/EOB_1041.pdf', created_at: '2026-07-27T09:00:00Z', metadata: null },
	{ name: '2026-07-27/EOB_1042.pdf', created_at: '2026-07-27T10:00:00Z', metadata: null }
];

function createMockSupabase(overrides: Record<string, Record<string, unknown>> = {}) {
	const tableChains: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {};

	function getChain(table: string) {
		if (!tableChains[table]) {
			const chain: Record<string, ReturnType<typeof vi.fn>> = {
				select: vi.fn().mockReturnThis(),
				gte: vi.fn().mockReturnThis(),
				lt: vi.fn().mockReturnThis(),
				order: vi.fn().mockReturnThis(),
				limit: vi.fn().mockResolvedValue({ data: mockSiblings, error: null }),
				in: vi.fn().mockResolvedValue({ data: [], error: null })
			};
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

describe('getFileViewSiblings', () => {
	it('queries files for the given date with stable ordering', async () => {
		const sb = createMockSupabase();
		const result = await getFileViewSiblings(sb as any, '2026-07-27');

		expect(sb.from).toHaveBeenCalledWith('files');
		const chain = sb._chain('files');
		expect(chain.gte).toHaveBeenCalledWith('created_at', '2026-07-27T00:00:00.000Z');
		expect(chain.lt).toHaveBeenCalledWith('created_at', '2026-07-27T23:59:59.999Z');
		expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: true });
		expect(chain.order).toHaveBeenCalledWith('name', { ascending: true });
		expect(chain.limit).toHaveBeenCalledWith(200);
		expect(result.data).toEqual(mockSiblings);
		expect(result.error).toBeNull();
	});

	it('excludes patient-linked files', async () => {
		const sb = createMockSupabase({
			patients_files: {
				in: vi.fn().mockResolvedValue({
					data: [{ file_name: mockSiblings[1].name }],
					error: null
				})
			}
		});

		const result = await getFileViewSiblings(sb as any, '2026-07-27');

		expect(result.data).toEqual([mockSiblings[0], mockSiblings[2]]);
		expect(result.error).toBeNull();
	});

	it('returns an empty list when no files exist on the date', async () => {
		const sb = createMockSupabase({
			files: {
				limit: vi.fn().mockResolvedValue({ data: [], error: null })
			}
		});

		const result = await getFileViewSiblings(sb as any, '2026-07-27');

		expect(result.data).toEqual([]);
		expect(result.error).toBeNull();
	});

	it('propagates a Supabase error from the files query', async () => {
		const mockError = { message: 'db error', code: '42P01', details: '', hint: '' };
		const sb = createMockSupabase({
			files: {
				limit: vi.fn().mockResolvedValue({ data: null, error: mockError })
			}
		});

		const result = await getFileViewSiblings(sb as any, '2026-07-27');

		expect(result.data).toEqual([]);
		expect(result.error).toEqual(mockError);
	});

	it('propagates an error from the patient-linked-file exclusion query', async () => {
		const mockError = { message: 'join error', code: '42P01', details: '', hint: '' };
		const sb = createMockSupabase({
			patients_files: {
				in: vi.fn().mockResolvedValue({ data: null, error: mockError })
			}
		});

		const result = await getFileViewSiblings(sb as any, '2026-07-27');

		expect(result.data).toEqual([]);
		expect(result.error).toEqual(mockError);
	});
});
