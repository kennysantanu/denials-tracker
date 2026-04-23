import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSignedUrl } from '$lib/server/db/files';

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = await locals.getUser();
	if (!user) {
		error(401, 'Unauthorized');
	}

	const name = url.searchParams.get('name');
	if (!name) {
		error(400, 'File name is required');
	}

	const result = await createSignedUrl(locals.supabase, name, 120);

	if (result.error || !result.data?.signedUrl) {
		error(500, 'Could not generate file URL');
	}

	return json({ signedUrl: result.data.signedUrl });
};
