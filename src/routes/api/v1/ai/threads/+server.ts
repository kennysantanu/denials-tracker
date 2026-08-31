import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { locals } = event;
	const user = await locals.getUser();
	if (!user) error(401, 'Unauthorized');

	const { data: threads, error: dbError } = await locals.supabase
		.from('chat_threads')
		.select('id, title, last_message_at, archived_at, created_at')
		.eq('user_id', user.id)
		.is('archived_at', null)
		.order('last_message_at', { ascending: false })
		.limit(20);

	if (dbError) {
		return json({ error: 'Failed to load threads' }, { status: 500 });
	}

	return json({
		threads: (threads ?? []).map((t) => ({
			id: t.id,
			title: t.title,
			lastMessageAt: t.last_message_at,
			archivedAt: t.archived_at,
			createdAt: t.created_at
		}))
	});
};
