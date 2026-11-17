import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('$lib/server/authz', () => ({ requirePermission: vi.fn() }));
vi.mock('$lib/server/audit', () => ({ logAudit: vi.fn() }));
vi.mock('$lib/server/appEvents', () => ({ logAppEvent: vi.fn() }));
vi.mock('$lib/server/db/denials', () => ({ deleteDenial: vi.fn() }));

import { actions } from './(app)/record/[patientId]/+page.server';
import { deleteDenial } from '$lib/server/db/denials';
import { logAppEvent } from '$lib/server/appEvents';

beforeEach(() => vi.clearAllMocks());

function event() {
	const single = vi.fn().mockResolvedValue({ data: { patient_id: 7 }, error: null });
	const supabase = { from: vi.fn(() => ({ select: () => ({ eq: () => ({ single }) }) })) };
	return {
		locals: { supabase, getUser: async () => ({ id: 'editor' }) },
		request: new Request('http://localhost/record/999?/deleteDenial', {
			method: 'POST',
			body: new URLSearchParams({ id: '42' })
		}),
		params: { patientId: '999' }
	} as any;
}

it('logs deletion without a dangling denial FK and retains the actual patient, not the route ID', async () => {
	vi.mocked(deleteDenial).mockResolvedValue({ data: null, error: null });
	expect(await actions.deleteDenial(event())).toEqual({ success: true });
	expect(logAppEvent).toHaveBeenCalledWith(
		expect.anything(),
		expect.objectContaining({
			eventName: 'denial.deleted',
			resourceId: '42',
			subjectDenialId: null,
			subjectPatientId: 7
		})
	);
});

it('does not emit a successful deletion event when deletion fails', async () => {
	vi.mocked(deleteDenial).mockResolvedValue({
		data: null,
		error: { message: 'Delete failed' } as any
	});
	expect(await actions.deleteDenial(event())).toMatchObject({ status: 400 });
	expect(logAppEvent).not.toHaveBeenCalled();
});
