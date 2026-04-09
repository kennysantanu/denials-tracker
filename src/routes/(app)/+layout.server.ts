import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends, url }) => {
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

	// HIPAA T-6.3.5: Password expiry check
	const passwordExpiryDays = parseInt(env.PASSWORD_EXPIRY_DAYS ?? '90', 10);
	const passwordChangedAt = userData?.password_changed_at;
	if (passwordChangedAt) {
		const expiryDate = new Date(passwordChangedAt);
		expiryDate.setDate(expiryDate.getDate() + passwordExpiryDays);
		if (new Date() > expiryDate && !url.pathname.startsWith('/setting/manage/account')) {
			redirect(302, '/setting/manage/account?expired=1');
		}
	}

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
