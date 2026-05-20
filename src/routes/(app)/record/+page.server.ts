import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getPatientsPaginated, createPatient } from '$lib/server/db/patients';
import { logAudit } from '$lib/server/audit';
import { requirePermission } from '$lib/server/authz';

const VALID_SORT_COLUMNS = ['last_name', 'first_name', 'date_of_birth', 'created_at'] as const;
type SortColumn = (typeof VALID_SORT_COLUMNS)[number];

export const load: PageServerLoad = async (event) => {
	const { locals, request, url } = event;
	const user = await locals.getUser();
	if (!user) {
		redirect(303, '/signin');
	}

	await requirePermission(event, 'patient.read', { resourceType: 'patient' });

	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
	const pageSize = Math.min(
		100,
		Math.max(10, parseInt(url.searchParams.get('pageSize') ?? '10', 10) || 10)
	);
	const search = url.searchParams.get('search') ?? '';
	const sortByParam = url.searchParams.get('sortBy') ?? 'last_name';
	const sortBy: SortColumn = VALID_SORT_COLUMNS.includes(sortByParam as SortColumn)
		? (sortByParam as SortColumn)
		: 'last_name';
	const sortDir = url.searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc';

	const { data, error } = await getPatientsPaginated(locals.supabase, {
		page,
		pageSize,
		search: search || undefined,
		sortBy,
		sortDir
	});

	if (error) {
		console.error('[record] Failed to load patients:', error);
	}

	logAudit(locals.supabase, user.id, 'view', 'patients', null, undefined, request);

	return {
		patients: data?.patients ?? [],
		total: data?.total ?? 0,
		page,
		pageSize,
		search,
		sortBy,
		sortDir
	};
};

export const actions: Actions = {
	createPatient: async (event) => {
		const { request, locals } = event;
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		await requirePermission(event, 'patient.create', { resourceType: 'patient' });

		const formData = await request.formData();
		const first_name = String(formData.get('first_name') ?? '').trim();
		const last_name = String(formData.get('last_name') ?? '').trim();
		const date_of_birth = String(formData.get('date_of_birth') ?? '').trim();
		const note = String(formData.get('note') ?? '').trim() || undefined;

		if (!first_name || !last_name || !date_of_birth) {
			return fail(400, { error: 'First name, last name, and date of birth are required' });
		}

		const { data: patient, error } = await createPatient(locals.supabase, {
			first_name,
			last_name,
			date_of_birth,
			note
		});

		if (error || !patient) {
			return fail(500, { error: error?.message ?? 'Failed to create patient' });
		}

		logAudit(
			locals.supabase,
			user.id,
			'create',
			'patient',
			String(patient.id),
			{ first_name, last_name, date_of_birth, note },
			request
		);

		redirect(303, `/record/${patient.id}`);
	}
};
