import { fail, redirect } from '@sveltejs/kit';
import { logAudit } from '$lib/server/audit';
import { getUserPreferences, setUserPreference, getSystemPreferences } from '$lib/server/db/preferences';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = await locals.getUser();
	if (!user) redirect(303, '/signin');

	const { data: userPreferences } = await getUserPreferences(locals.supabase, user.id);
	const { data: systemPreferences } = await getSystemPreferences(locals.supabase);

	return {
		userPreferences: userPreferences ?? [],
		systemPreferences: systemPreferences ?? []
	};
};

export const actions: Actions = {
	setPreference: async ({ request, locals }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const formData = await request.formData();
		const preferenceId = Number(formData.get('preference_id'));
		const value = formData.get('value') as string | null;

		if (!preferenceId) return fail(400, { error: 'Invalid preference ID' });

		const { error } = await setUserPreference(locals.supabase, preferenceId, user.id, value);
		if (error) return fail(500, { error: error.message });

		logAudit(locals.supabase, user.id, 'update', 'preference', String(preferenceId), { value }, request);

		return { success: true };
	}
};
