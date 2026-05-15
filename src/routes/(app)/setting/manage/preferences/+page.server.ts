import { fail, redirect } from '@sveltejs/kit';
import { logAudit } from '$lib/server/audit';
import {
	getUserPreferences,
	setUserPreference,
	getSystemPreferences,
	MANAGED_PREFERENCE_NAMES
} from '$lib/server/db/preferences';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = await locals.getUser();
	if (!user) redirect(303, '/signin');

	const [{ data: userPreferences }, { data: systemPreferences }] = await Promise.all([
		getUserPreferences(locals.supabase, user.id),
		getSystemPreferences(locals.supabase)
	]);

	// Hide admin-managed prefs (AI config, idle timeout, prompts) — they are
	// edited from the admin page and have no per-user effect.
	const filteredSystem = (systemPreferences ?? []).filter(
		(p) => !MANAGED_PREFERENCE_NAMES.has(p.name)
	);

	return {
		userPreferences: userPreferences ?? [],
		systemPreferences: filteredSystem
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

		// Verify the target preference exists and is not admin-managed.
		// (DB RLS + the FK already restrict overrides to a real preference,
		// but we want a clean 400 instead of an opaque DB error.)
		const { data: pref, error: prefError } = await locals.supabase
			.from('preferences')
			.select('id, name')
			.eq('id', preferenceId)
			.single();
		if (prefError || !pref) return fail(404, { error: 'Preference not found' });
		if (MANAGED_PREFERENCE_NAMES.has(pref.name)) {
			return fail(400, { error: 'This preference cannot be overridden per user' });
		}

		const { error } = await setUserPreference(locals.supabase, preferenceId, user.id, value);
		if (error) return fail(500, { error: error.message });

		logAudit(
			locals.supabase,
			user.id,
			'update',
			'preference',
			String(preferenceId),
			{ value, name: pref.name },
			request
		);

		return { success: true };
	}
};
