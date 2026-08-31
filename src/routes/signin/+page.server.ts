import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { getAuditSupabaseClient, logAudit } from '$lib/server/audit';
import { env } from '$env/dynamic/private';
import type { Actions, PageServerLoad } from './$types';

const signInSchema = z.object({
	email: z.string(),
	password: z.string().min(8, 'Password must be at least 8 characters')
});

function getClientIp(request: Request): string | null {
	return (
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		request.headers.get('x-real-ip')
	);
}

function resolveClientIp(
	request: Request,
	getClientAddress: (() => string) | undefined
): string | null {
	const forwardedIp = getClientIp(request);
	if (forwardedIp) return forwardedIp;
	if (!getClientAddress) return null;

	try {
		return getClientAddress();
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	const user = await locals.getUser();
	if (user) redirect(303, '/record');

	const form = await superValidate(zod(signInSchema));
	return { form };
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase }, getClientAddress }) => {
		const form = await superValidate(request, zod(signInSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		const email = form.data.email as string;
		const password = form.data.password as string;

		// Rate limiting: check recent failed login attempts when a client address is available.
		const maxAttempts = parseInt(env.MAX_LOGIN_ATTEMPTS ?? '5', 10);
		const ipAddress = resolveClientIp(request, getClientAddress);

		const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

		let count: number | null = null;
		let rateLimitError: Error | null = null;

		if (ipAddress) {
			const rateLimitResult = await getAuditSupabaseClient(supabase)
				.from('audit_log')
				.select('*', { count: 'exact', head: true })
				.eq('action', 'login_failed')
				.eq('ip_address', ipAddress)
				.gte('created_at', fifteenMinutesAgo);

			count = rateLimitResult.count;
			rateLimitError = rateLimitResult.error;
		}

		if (rateLimitError) {
			console.error('[auth] Failed to read login attempt count:', rateLimitError);
		} else if (ipAddress && count !== null && count >= maxAttempts) {
			return fail(429, {
				form,
				error: 'Too many failed login attempts. Please try again later.'
			});
		}

		const { error } = await supabase.auth.signInWithPassword({ email, password });

		if (error) {
			// Log failed attempt
			logAudit(supabase, null, 'login_failed', 'session', null, { email }, request, ipAddress);

			return fail(400, {
				form,
				error: 'Invalid email or password.'
			});
		}

		// Log successful login
		const {
			data: { user }
		} = await supabase.auth.getUser();
		logAudit(supabase, user?.id ?? null, 'login', 'session', null, { email }, request, ipAddress);

		redirect(303, '/record');
	}
};
