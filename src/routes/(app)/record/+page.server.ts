import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPatientsPaginated } from '$lib/server/db/patients';
import { logAudit } from '$lib/server/audit';

const VALID_SORT_COLUMNS = ['last_name', 'first_name', 'date_of_birth', 'created_at'] as const;
type SortColumn = (typeof VALID_SORT_COLUMNS)[number];

export const load: PageServerLoad = async ({ locals, request, url }) => {
	const user = await locals.getUser();
	if (!user) {
		redirect(303, '/signin');
	}

	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
	const pageSize = Math.min(
		100,
		Math.max(10, parseInt(url.searchParams.get('pageSize') ?? '25', 10) || 25)
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
