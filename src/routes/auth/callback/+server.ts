import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code');
	const next = url.searchParams.get('next') ?? '/dashboard';

	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);

		if (!error) {
			// Open redirect guard: must be a relative path starting with single /
			const safeNext = /^\/[^/]/.test(next) ? next : '/dashboard';
			redirect(303, safeNext);
		}
	}

	redirect(303, '/signin');
};
