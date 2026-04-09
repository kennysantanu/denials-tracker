import { fail, redirect } from '@sveltejs/kit';
import { logAudit } from '$lib/server/audit';
import { getSystemPreferences, getSystemPreference, setSystemPreference } from '$lib/server/db/preferences';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = await locals.getUser();
	if (!user) redirect(303, '/signin');

	const [prefResult, aiBaseUrlResult, aiModelNameResult] = await Promise.all([
		getSystemPreferences(locals.supabase),
		getSystemPreference(locals.supabase, 'ai_base_url'),
		getSystemPreference(locals.supabase, 'ai_model_name')
	]);

	// Filter out AI prefs from the general list
	const aiPrefNames = new Set(['ai_base_url', 'ai_model_name', 'ai_enabled']);
	const preferences = (prefResult.data ?? []).filter((p) => !aiPrefNames.has(p.name));

	return {
		preferences,
		aiBaseUrl: aiBaseUrlResult.data?.value ?? '',
		aiModelName: aiModelNameResult.data?.value ?? ''
	};
};

export const actions: Actions = {
	saveAIConfig: async ({ request, locals }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const formData = await request.formData();
		const aiBaseUrl = (formData.get('ai_base_url') as string)?.trim() || '';
		const aiModelName = (formData.get('ai_model_name') as string)?.trim() || '';

		const [baseUrlResult, modelResult] = await Promise.all([
			setSystemPreference(locals.supabase, 'ai_base_url', aiBaseUrl || null),
			setSystemPreference(locals.supabase, 'ai_model_name', aiModelName || null)
		]);

		if (baseUrlResult.error || modelResult.error) {
			return fail(500, { error: baseUrlResult.error?.message ?? modelResult.error?.message ?? 'Failed to save AI config' });
		}

		// Set ai_enabled based on whether both fields are provided
		const aiEnabled = !!(aiBaseUrl && aiModelName);
		await setSystemPreference(locals.supabase, 'ai_enabled', aiEnabled ? 'true' : 'false');

		logAudit(locals.supabase, user.id, 'update', 'preference', 'ai_config', { aiBaseUrl: !!aiBaseUrl, aiModelName: !!aiModelName }, request);

		return { success: true };
	},

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
