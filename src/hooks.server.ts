import { createServerClient } from '@supabase/ssr';
import { type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '$lib/supabase';

const supabaseHandle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient<Database>(
		PUBLIC_SUPABASE_URL!,
		PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				getAll: () => event.cookies.getAll(),
				setAll: (cookiesToSet) => {
					cookiesToSet.forEach(({ name, value, options }) => {
						event.cookies.set(name, value, {
							...options,
							path: '/',
							secure: true,
							httpOnly: true,
							sameSite: 'strict'
						});
					});
				}
			}
		}
	);

	event.locals.getUser = async () => {
		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error) return null;
		return user;
	};

	const {
		data: { session }
	} = await event.locals.supabase.auth.getSession();
	event.locals.session = session;

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};

const securityHeadersHandle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// HIPAA T-6.4.1: Prevent caching of PHI routes
	const path = event.url.pathname;
	if (
		path.startsWith('/dashboard') ||
		path.startsWith('/record') ||
		path.startsWith('/file') ||
		path.startsWith('/report') ||
		path.startsWith('/setting') ||
		path.startsWith('/api/')
	) {
		response.headers.set('Cache-Control', 'no-store');
	}

	response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	// Allow iframes for file preview page (PDF viewer), deny everywhere else
	if (path.startsWith('/file/view')) {
		response.headers.set('X-Frame-Options', 'SAMEORIGIN');
		response.headers.set('Content-Security-Policy', `frame-src 'self' ${PUBLIC_SUPABASE_URL};`);
	} else {
		response.headers.set('X-Frame-Options', 'DENY');
	}
	return response;
};

export const handle = sequence(supabaseHandle, securityHeadersHandle);
