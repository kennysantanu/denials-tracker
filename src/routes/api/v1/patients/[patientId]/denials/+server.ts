import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requirePermission } from '$lib/server/authz';
import { getDenialsByPatient } from '$lib/server/db/denials';

export const GET: RequestHandler = async (event) => {
	const { locals, params } = event;
	const user = await locals.getUser();
	if (!user) error(401, 'Unauthorized');

	const patientId = Number(params.patientId);
	if (!Number.isInteger(patientId) || patientId <= 0) {
		error(400, 'Invalid patient ID');
	}

	await requirePermission(event, 'patient.read', {
		resourceType: 'patient',
		resourceId: String(patientId),
		subjectPatientId: patientId
	});

	const { data, error: dbError } = await getDenialsByPatient(locals.supabase, patientId);
	if (dbError) error(500, 'Could not load denials');

	return json({
		denials: (data ?? []).map((denial) => ({
			id: denial.id,
			service_start_date: denial.service_start_date,
			service_end_date: denial.service_end_date,
			is_closed: denial.is_closed
		}))
	});
};
