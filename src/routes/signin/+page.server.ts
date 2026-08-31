import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { getAuditSupabaseClient, logAudit, resolveClientIp } from '$lib/server/audit';
import { env } from '$env/dynamic/private';
import type { Actions, PageServerLoad } from './$types';

// Sign-in must not enforce the account-creation password policy — it would
// lock out users with legacy passwords and leaks the policy to attackers.
const signInSchema = z.object({
	email: z.email('Enter a valid email address'),
	password: z.string().min(1, 'Password is required')
});

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;

function parseMaxAttempts(raw: string | undefined): number {
	const parsed = Number.parseInt(raw ?? '', 10);
	if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_MAX_ATTEMPTS;
	return parsed;
}

/**
 * Only same-origin paths may be used as post-sign-in destinations, to avoid
 * turning this page into an open redirector.
 */
function safeRedirectPath(url: URL): string {
	const target = url.searchParams.get('redirectTo');
	if (target && target.startsWith('/') && !target.startsWith('//') && !target.includes('\\')) {
		return target;
	}
	return '/record';
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = await locals.getUser();
	const redirectTo = safeRedirectPath(url);
	if (user) redirect(303, redirectTo);

	const form = await superValidate(zod(signInSchema));
	return { form, redirectTo };
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase }, getClientAddress, url }) => {
		const form = await superValidate(request, zod(signInSchema));
		const redirectTo = safeRedirectPath(url);

		if (!form.valid) {
			form.data.password = '';
			return fail(400, { form });
		}

		const email = form.data.email.trim().toLowerCase();
		const password = form.data.password;

		// Rate limiting: check recent failed login attempts when a client address is available.
		const maxAttempts = parseMaxAttempts(env.MAX_LOGIN_ATTEMPTS);
		const ipAddress = resolveClientIp(request, getClientAddress);

		const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

		let count: number | null = null;
		let rateLimitError: Error | null = null;

		if (ipAddress) {
			const rateLimitResult = await getAuditSupabaseClient(supabase)
				.from('audit_log')
				.select('*', { count: 'exact', head: true })
				.eq('action', 'login_failed')
				.eq('ip_address', ipAddress)
				.gte('created_at', windowStart);

			count = rateLimitResult.count;
			rateLimitError = rateLimitResult.error;
		}

		if (rateLimitError) {
			console.error('[auth] Failed to read login attempt count:', rateLimitError);
		} else if (ipAddress && count !== null && count >= maxAttempts) {
			form.data.password = '';
			return fail(429, {
				form,
				error: 'Too many failed login attempts. Please try again later.'
			});
		}

		const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

		if (error) {
			// Log failed attempt
			logAudit(supabase, null, 'login_failed', 'session', null, { email }, request, ipAddress);

			form.data.password = '';
			return fail(400, {
				form,
				error: 'Invalid email or password.'
			});
		}

		// Log successful login (signInWithPassword already returns the user).
		logAudit(
			supabase,
			signInData.user?.id ?? null,
			'login',
			'session',
			null,
			{ email },
			request,
			ipAddress
		);

		redirect(303, redirectTo);
	}
};
