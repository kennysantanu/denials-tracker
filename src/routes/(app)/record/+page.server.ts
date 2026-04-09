import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPatients } from '$lib/server/db/patients';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, request }) => {
	const user = await locals.getUser();
	if (!user) {
		redirect(303, '/signin');
	}

	const { data: patients, error } = await getPatients(locals.supabase);

	if (error) {
		console.error('[record] Failed to load patients:', error);
	}

	logAudit(locals.supabase, user.id, 'view', 'patients', null, undefined, request);

	return {
		patients: patients ?? []
	};
};
