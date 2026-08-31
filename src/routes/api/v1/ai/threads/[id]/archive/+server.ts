import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const { locals, params } = event;
	const user = await locals.getUser();
	if (!user) error(401, 'Unauthorized');

	const threadId = params.id;
	if (!threadId) error(400, 'Missing thread ID');

	const { error: dbError } = await locals.supabase
		.from('chat_threads')
		.update({ archived_at: new Date().toISOString() })
		.eq('id', threadId)
		.eq('user_id', user.id);

	if (dbError) {
		return json({ error: 'Failed to archive thread' }, { status: 500 });
	}

	return json({ ok: true });
};
