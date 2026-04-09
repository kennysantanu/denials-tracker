import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = await locals.getUser();

	if (user) {
		redirect(303, '/dashboard');
	}

	redirect(303, '/signin');
};
