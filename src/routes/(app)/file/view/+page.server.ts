import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createSignedUrl } from '$lib/server/db/files';
import { logAudit } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, url, request }) => {
	const user = await locals.getUser();
	if (!user) {
		redirect(303, '/signin');
	}

	const name = url.searchParams.get('name');
	if (!name) {
		redirect(303, '/file');
	}

	const { data, error } = await createSignedUrl(locals.supabase, name, 60);

	if (error || !data?.signedUrl) {
		return {
			signedUrl: null,
			fileName: name,
			error: 'Could not generate file URL'
		};
	}

	logAudit(locals.supabase, user.id, 'view', 'file', name, undefined, request);

	return {
		signedUrl: data.signedUrl,
		fileName: name
	};
};
