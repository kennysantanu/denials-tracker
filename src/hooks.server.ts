import { createServerClient } from '@supabase/ssr';
import { type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '$lib/supabase';

/**
 * Returns true when the request arrived over HTTPS.
 *
 * SvelteKit's adapter-node reads PROTOCOL_HEADER (set to x-forwarded-proto in
 * docker-compose.yml) and populates event.url.protocol accordingly, so this
 * works correctly whether the app is behind a TLS-terminating reverse proxy or
 * accessed directly over plain HTTP (e.g. a LAN/Portainer deployment).
 *
 * AUTH_COOKIE_SECURE=true|false can force the value when needed.
 */
function isSecureRequest(event: Parameters<Handle>[0]['event']): boolean {
	const override = env.AUTH_COOKIE_SECURE?.toLowerCase();
	if (override === 'true') return true;
	if (override === 'false') return false;
	return event.url.protocol === 'https:';
}

const supabaseHandle: Handle = async ({ event, resolve }) => {
	const secure = isSecureRequest(event);

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
							secure
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
	const secure = isSecureRequest(event);

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

	// Only emit HSTS over HTTPS. Sending it on HTTP causes browsers to
	// permanently upgrade the host to HTTPS and break plain-HTTP deployments.
	if (secure) {
		response.headers.set(
			'Strict-Transport-Security',
			'max-age=31536000; includeSubDomains; preload'
		);
	}
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
