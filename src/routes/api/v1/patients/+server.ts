import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requirePermission } from '$lib/server/authz';
import { getPatientsPaginated } from '$lib/server/db/patients';

export const GET: RequestHandler = async (event) => {
	const { locals, url } = event;
	const user = await locals.getUser();
	if (!user) error(401, 'Unauthorized');

	await requirePermission(event, 'patient.read', { resourceType: 'patient' });

	const q = url.searchParams.get('q')?.trim() ?? '';

	// Single combined search box: matches last name, first name, or date of birth
	// (same semantics as the /record patient list search).
	if (q) {
		const { data, error: dbError } = await getPatientsPaginated(locals.supabase, {
			search: q,
			pageSize: 5
		});
		if (dbError) error(500, 'Search failed');

		return json({ patients: data?.patients ?? [] });
	}

	const lastName = url.searchParams.get('last_name')?.trim() ?? '';
	const firstName = url.searchParams.get('first_name')?.trim() ?? '';
	const dob = url.searchParams.get('dob')?.trim() ?? '';

	if (!lastName && !firstName && !dob) {
		return json({ patients: [] });
	}

	let query = locals.supabase
		.from('patients')
		.select('id, first_name, last_name, date_of_birth')
		.eq('is_active', true)
		.limit(5);

	if (dob) query = query.eq('date_of_birth', dob);
	if (lastName) query = query.ilike('last_name', `${lastName}%`);
	if (firstName) query = query.ilike('first_name', `${firstName}%`);

	query = query.order('last_name').order('first_name');

	const { data, error: dbError } = await query;
	if (dbError) error(500, 'Search failed');

	return json({ patients: data ?? [] });
};
