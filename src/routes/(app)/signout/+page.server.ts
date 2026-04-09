import { redirect } from '@sveltejs/kit';
import { logAudit } from '$lib/server/audit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ locals: { supabase }, request }) => {
		const {
			data: { user }
		} = await supabase.auth.getUser();

		logAudit(supabase, user?.id ?? null, 'logout', 'session', null, undefined, request);

		// Delete chat conversations for this user's session (Phase 4.4.1)
		// Note: conversations table is created in Phase 5. This is a best-effort cleanup.
		if (user) {
			const { data: session } = await supabase.auth.getSession();
			const sessionId = session?.session?.access_token;
			if (sessionId) {
				await (supabase as any)
					.from('conversations')
					.delete()
					.eq('user_id', user.id)
					.eq('session_id', sessionId)
					.catch(() => {});
			}
		}

		await supabase.auth.signOut();
		redirect(303, '/signin');
	}
};
