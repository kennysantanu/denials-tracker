import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent, locals: { safeGetSession } }) => {
	await parent();
	const { session } = await safeGetSession();

	if (!session) {
		redirect(303, '/signin')
	}
}
