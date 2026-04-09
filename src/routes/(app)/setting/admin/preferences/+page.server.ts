import { fail, redirect } from '@sveltejs/kit';
import { logAudit } from '$lib/server/audit';
import { getSystemPreferences, setSystemPreference } from '$lib/server/db/preferences';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = await locals.getUser();
	if (!user) redirect(303, '/signin');

	const { data: preferences } = await getSystemPreferences(locals.supabase);

	return { preferences: preferences ?? [] };
};

export const actions: Actions = {
	setPreference: async ({ request, locals }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const value = formData.get('value') as string | null;
		const dataType = (formData.get('data_type') as string) || 'string';

		if (!name) return fail(400, { error: 'Preference name is required' });

		const { error } = await setSystemPreference(locals.supabase, name, value, dataType);
		if (error) return fail(500, { error: error.message });

		logAudit(locals.supabase, user.id, 'update', 'preference', name, { value, dataType }, request);

		return { success: true };
	}
};
