import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { logAudit } from '$lib/server/audit';
import {
	getSystemPreferences,
	getSystemPreference,
	setSystemPreference
} from '$lib/server/db/preferences';
import { requirePermission } from '$lib/server/authz';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async (event) => {
	const { locals } = event;
	const user = await locals.getUser();
	if (!user) redirect(303, '/signin');

	await requirePermission(event, 'system_preferences.read', { resourceType: 'preference' });

	const [
		prefResult,
		aiBaseUrlResult,
		aiModelNameResult,
		idleTimeoutResult,
		aiChatPromptResult,
		aiRewritePromptResult
	] = await Promise.all([
		getSystemPreferences(locals.supabase),
		getSystemPreference(locals.supabase, 'ai_base_url'),
		getSystemPreference(locals.supabase, 'ai_model_name'),
		getSystemPreference(locals.supabase, 'idle_timeout_minutes'),
		getSystemPreference(locals.supabase, 'ai_chat_system_prompt'),
		getSystemPreference(locals.supabase, 'ai_rewrite_system_prompt')
	]);

	// Filter out managed prefs from the generic list
	const managedPrefNames = new Set([
		'ai_base_url',
		'ai_model_name',
		'ai_enabled',
		'idle_timeout_minutes',
		'ai_chat_system_prompt',
		'ai_rewrite_system_prompt'
	]);
	const preferences = (prefResult.data ?? []).filter((p) => !managedPrefNames.has(p.name));

	// Env cap for idle timeout (max allowed value, up to 1440 min / 24 h)
	const maxIdleTimeout = Math.min(parseInt(env.SESSION_TIMEOUT_MINUTES ?? '30', 10) || 30, 1440);

	return {
		preferences,
		aiBaseUrl: aiBaseUrlResult.data?.value ?? '',
		aiModelName: aiModelNameResult.data?.value ?? '',
		idleTimeoutMinutes: idleTimeoutResult.data?.value
			? parseInt(idleTimeoutResult.data.value, 10)
			: 15,
		maxIdleTimeout,
		aiChatSystemPrompt: aiChatPromptResult.data?.value ?? '',
		aiRewriteSystemPrompt: aiRewritePromptResult.data?.value ?? ''
	};
};

export const actions: Actions = {
	saveIdleTimeout: async (event) => {
		const { request, locals } = event;
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		await requirePermission(event, 'system_preferences.update', { resourceType: 'preference' });

		const formData = await request.formData();
		const rawValue = parseInt(formData.get('idle_timeout_minutes') as string, 10);

		// Enforce cap from env var
		const envMax = Math.min(parseInt(env.SESSION_TIMEOUT_MINUTES ?? '30', 10) || 30, 1440);
		if (isNaN(rawValue) || rawValue < 1 || rawValue > envMax) {
			return fail(400, { error: `Idle timeout must be between 1 and ${envMax} minutes` });
		}

		const { error } = await setSystemPreference(
			locals.supabase,
			'idle_timeout_minutes',
			String(rawValue),
			'number'
		);
		if (error) return fail(500, { error: error.message });

		logAudit(
			locals.supabase,
			user.id,
			'update',
			'preference',
			'idle_timeout_minutes',
			{ value: rawValue, maxAllowed: envMax },
			request
		);

		return { success: true };
	},

	saveAIConfig: async (event) => {
		const { request, locals } = event;
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		await requirePermission(event, 'system_preferences.update', { resourceType: 'preference' });

		const formData = await request.formData();
		const aiBaseUrl = (formData.get('ai_base_url') as string)?.trim() || '';
		const aiModelName = (formData.get('ai_model_name') as string)?.trim() || '';

		const [baseUrlResult, modelResult] = await Promise.all([
			setSystemPreference(locals.supabase, 'ai_base_url', aiBaseUrl || null),
			setSystemPreference(locals.supabase, 'ai_model_name', aiModelName || null)
		]);

		if (baseUrlResult.error || modelResult.error) {
			return fail(500, {
				error:
					baseUrlResult.error?.message ?? modelResult.error?.message ?? 'Failed to save AI config'
			});
		}

		// Set ai_enabled based on whether both fields are provided
		const aiEnabled = !!(aiBaseUrl && aiModelName);
		await setSystemPreference(locals.supabase, 'ai_enabled', aiEnabled ? 'true' : 'false');

		logAudit(
			locals.supabase,
			user.id,
			'update',
			'preference',
			'ai_config',
			{ aiBaseUrl: !!aiBaseUrl, aiModelName: !!aiModelName },
			request
		);

		return { success: true };
	},

	saveAIChatPrompt: async (event) => {
		const { request, locals } = event;
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		await requirePermission(event, 'system_preferences.update', { resourceType: 'preference' });

		const formData = await request.formData();
		const value = (formData.get('ai_chat_system_prompt') as string)?.trim() || null;

		const { error } = await setSystemPreference(
			locals.supabase,
			'ai_chat_system_prompt',
			value,
			'string'
		);
		if (error) return fail(500, { error: error.message });

		logAudit(
			locals.supabase,
			user.id,
			'update',
			'preference',
			'ai_chat_system_prompt',
			{ cleared: !value },
			request
		);

		return { success: true };
	},

	saveAIRewritePrompt: async (event) => {
		const { request, locals } = event;
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		await requirePermission(event, 'system_preferences.update', { resourceType: 'preference' });

		const formData = await request.formData();
		const value = (formData.get('ai_rewrite_system_prompt') as string)?.trim() || null;

		const { error } = await setSystemPreference(
			locals.supabase,
			'ai_rewrite_system_prompt',
			value,
			'string'
		);
		if (error) return fail(500, { error: error.message });

		logAudit(
			locals.supabase,
			user.id,
			'update',
			'preference',
			'ai_rewrite_system_prompt',
			{ cleared: !value },
			request
		);

		return { success: true };
	},

	setPreference: async (event) => {
		const { request, locals } = event;
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		await requirePermission(event, 'system_preferences.update', { resourceType: 'preference' });

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
