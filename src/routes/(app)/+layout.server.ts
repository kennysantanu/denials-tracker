import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends, url }) => {
	depends('supabase:auth');

	const user = await locals.getUser();
	if (!user) {
		redirect(303, '/signin');
	}

	// Run user+role fetch and preferences queries in parallel — preferences don't
	// depend on the user ID, so there's no reason to wait for the first query.
	const [{ data: userData }, [{ data: aiPref }, { data: timeoutPref }]] = await Promise.all([
		locals.supabase.from('users').select('*, roles(*)').eq('id', user.id).single(),
		Promise.all([
			locals.supabase.from('preferences').select('value').eq('name', 'ai_enabled').single(),
			locals.supabase
				.from('preferences')
				.select('value')
				.eq('name', 'idle_timeout_minutes')
				.single()
		])
	]);

	const permissions =
		(userData?.roles as { permissions?: Record<string, boolean> } | null)?.permissions ?? {};

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

	const aiEnabled = aiPref?.value === 'true';

	// HIPAA: Idle timeout — env var sets the max cap (default 30, up to 1440 min / 24 h), DB preference sets the actual value
	const envMaxTimeout = Math.min(parseInt(env.SESSION_TIMEOUT_MINUTES ?? '30', 10) || 30, 1440);
	const dbTimeout = timeoutPref?.value ? parseInt(timeoutPref.value, 10) : null;
	const idleTimeoutMinutes =
		dbTimeout && dbTimeout >= 1 && dbTimeout <= envMaxTimeout
			? dbTimeout
			: Math.min(15, envMaxTimeout); // default 15, never exceed cap

	return {
		user,
		userData,
		permissions,
		aiEnabled,
		idleTimeoutMinutes
	};
};
