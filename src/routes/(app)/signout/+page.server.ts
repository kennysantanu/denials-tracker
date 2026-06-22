import { redirect } from '@sveltejs/kit';
import { logAudit } from '$lib/server/audit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ locals: { supabase }, request }) => {
		const {
			data: { user }
		} = await supabase.auth.getUser();

		logAudit(supabase, user?.id ?? null, 'logout', 'session', null, undefined, request);

		await supabase.auth.signOut();
		redirect(303, '/signin');
	}
};
