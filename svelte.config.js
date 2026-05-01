import nodeAdapter from '@sveltejs/adapter-node';
import cloudflareAdapter from '@sveltejs/adapter-cloudflare';
import { relative, sep } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

// Pick adapter at build time:
//   SK_ADAPTER=cloudflare  -> Cloudflare Pages / Workers
//   anything else (default) -> adapter-node (Docker, Portainer, local dev)
const adapter = process.env.SK_ADAPTER === 'cloudflare' ? cloudflareAdapter() : nodeAdapter();

// Read PUBLIC_SUPABASE_URL for CSP connect-src (env files aren't loaded yet at config time)
function getSupabaseUrl() {
	if (process.env.PUBLIC_SUPABASE_URL) return process.env.PUBLIC_SUPABASE_URL;
	for (const file of ['.env.local', '.env']) {
		if (existsSync(file)) {
			const match = readFileSync(file, 'utf-8').match(/^PUBLIC_SUPABASE_URL=(.*)$/m);
			if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
		}
	}
	return '';
}

const supabaseUrl = getSupabaseUrl();

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// defaults to rune mode for the project, except for `node_modules`. Can be removed in svelte 6.
		runes: ({ filename }) => {
			const relativePath = relative(import.meta.dirname, filename);
			const pathSegments = relativePath.toLowerCase().split(sep);
			const isExternalLibrary = pathSegments.includes('node_modules');

			return isExternalLibrary ? undefined : true;
		}
	},
	kit: {
		adapter: adapter,
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:', 'blob:'],
				'connect-src': ['self', ...(supabaseUrl ? [supabaseUrl] : [])],
				'font-src': ['self'],
				'frame-ancestors': ['none'],
				'base-uri': ['self'],
				'form-action': ['self']
			}
		}
	}
};

export default config;
