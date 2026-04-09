import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	depends('supabase:auth');

	const user = await locals.getUser();
	if (!user) {
		redirect(303, '/signin');
	}

	// Load user record with role + permissions
	const { data: userData } = await locals.supabase
		.from('users')
		.select('*, roles(*)')
		.eq('id', user.id)
		.single();

	const permissions = (userData?.roles as { permissions?: Record<string, boolean> } | null)
		?.permissions ?? {};

	// Check if AI is enabled via system preferences
	const { data: aiPref } = await locals.supabase
		.from('preferences')
		.select('value')
		.eq('name', 'ai_enabled')
		.single();

	const aiEnabled = aiPref?.value === 'true';

	return {
		user,
		userData,
		permissions,
		aiEnabled
	};
};
