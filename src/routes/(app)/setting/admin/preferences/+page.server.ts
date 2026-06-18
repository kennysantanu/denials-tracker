import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabaseUrl } from '$lib/server/supabaseUrl';
import { logAudit } from '$lib/server/audit';
import {
	getSystemPreferences,
	getSystemPreference,
	setSystemPreference,
	MANAGED_PREFERENCE_NAMES
} from '$lib/server/db/preferences';
import { requirePermission } from '$lib/server/authz';
import type { Database } from '$lib/supabase';
import type { PageServerLoad, Actions } from './$types';

function getAdminClient() {
	return createClient<Database>(getServerSupabaseUrl(), env.SUPABASE_SERVICE_ROLE_KEY);
}

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
	const preferences = (prefResult.data ?? []).filter((p) => !MANAGED_PREFERENCE_NAMES.has(p.name));

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
			getAdminClient(),
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

		// Validate URL when provided. Must be a parseable http/https URL so we
		// don't store junk that breaks fetch() later in the AI layer.
		if (aiBaseUrl) {
			let parsed: URL;
			try {
				parsed = new URL(aiBaseUrl);
			} catch {
				return fail(400, { error: 'AI base URL must be a valid URL' });
			}
			if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
				return fail(400, { error: 'AI base URL must use http or https' });
			}
		}

		const adminClient = getAdminClient();
		const [baseUrlResult, modelResult] = await Promise.all([
			setSystemPreference(adminClient, 'ai_base_url', aiBaseUrl || null),
			setSystemPreference(adminClient, 'ai_model_name', aiModelName || null)
		]);

		if (baseUrlResult.error || modelResult.error) {
			return fail(500, {
				error:
					baseUrlResult.error?.message ?? modelResult.error?.message ?? 'Failed to save AI config'
			});
		}

		// Set ai_enabled based on whether both fields are provided
		const aiEnabled = !!(aiBaseUrl && aiModelName);
		await setSystemPreference(adminClient, 'ai_enabled', aiEnabled ? 'true' : 'false');

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
			getAdminClient(),
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
			getAdminClient(),
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

		if (!name) return fail(400, { error: 'Preference name is required' });

		// Managed preferences have dedicated forms/validation; refuse to update
		// them through the generic action even if the name is forged.
		if (MANAGED_PREFERENCE_NAMES.has(name)) {
			return fail(400, { error: 'This preference must be edited from its dedicated section' });
		}

		// Only allow updating preferences that already exist; never create new
		// rows here, and ignore any client-supplied data_type.
		const { data: existing, error: existingError } = await getSystemPreference(
			locals.supabase,
			name
		);
		if (existingError || !existing) {
			return fail(404, { error: 'Preference not found' });
		}

		const { error } = await setSystemPreference(getAdminClient(), name, value, existing.data_type);
		if (error) return fail(500, { error: error.message });

		logAudit(
			locals.supabase,
			user.id,
			'update',
			'preference',
			name,
			{ value, dataType: existing.data_type },
			request
		);

		return { success: true };
	}
};
