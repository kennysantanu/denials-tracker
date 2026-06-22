import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { locals, params, url } = event;
	const user = await locals.getUser();
	if (!user) error(401, 'Unauthorized');

	const threadId = params.id;
	if (!threadId) error(400, 'Missing thread ID');

	const before = url.searchParams.get('before');

	let query = locals.supabase
		.from('conversations')
		.select('id, client_message_id, role, content, tool_name, context_snapshot, created_at')
		.eq('thread_id', threadId)
		.is('deleted_at', null)
		.order('created_at', { ascending: true })
		.limit(50);

	if (before) {
		query = query.lt('id', parseInt(before, 10));
	}

	const { data: rows, error: dbError } = await query;

	if (dbError) {
		return json({ error: 'Failed to load messages' }, { status: 500 });
	}

	return json({
		messages: (rows ?? []).map((m) => ({
			id: m.client_message_id ?? String(m.id),
			role: m.role,
			content: m.content,
			toolName: m.tool_name,
			createdAt: m.created_at
		}))
	});
};

export const POST: RequestHandler = async (event) => {
	const { locals, params, request } = event;
	const user = await locals.getUser();
	if (!user) error(401, 'Unauthorized');

	const threadId = params.id;
	if (!threadId) error(400, 'Missing thread ID');

	const body = await request.json();
	const { clientMessageId, role, content, toolName } = body as {
		clientMessageId: string;
		role: string;
		content: string;
		toolName?: string;
	};

	if (!clientMessageId || !role || !content) {
		error(400, 'Missing required fields: clientMessageId, role, content');
	}

	if (!['user', 'assistant', 'tool'].includes(role)) {
		error(400, 'Invalid role');
	}

	const sessionId = locals.session?.access_token ?? '';

	// Upsert: create thread row if first message
	const { data: existingThread } = await locals.supabase
		.from('chat_threads')
		.select('id')
		.eq('id', threadId)
		.maybeSingle();

	if (!existingThread) {
		const title = role === 'user' ? content.slice(0, 40) : 'New chat';
		const { error: threadError } = await locals.supabase
			.from('chat_threads')
			.insert({
				id: threadId,
				user_id: user.id,
				title
			});

		if (threadError) {
			return json({ error: 'Failed to create thread' }, { status: 500 });
		}
	}

	// Insert message with idempotency guard
	const { data: inserted, error: insertError } = await locals.supabase
		.from('conversations')
		.insert({
			thread_id: threadId,
			client_message_id: clientMessageId,
			user_id: user.id,
			session_id: sessionId,
			role,
			content,
			tool_name: toolName ?? null
		})
		.select('id, client_message_id, role, content, tool_name, created_at')
		.single();

	if (insertError) {
		// Idempotency: if unique constraint violated, return existing row
		if (insertError.code === '23505') {
			const { data: existing } = await locals.supabase
				.from('conversations')
				.select('id, client_message_id, role, content, tool_name, created_at')
				.eq('thread_id', threadId)
				.eq('client_message_id', clientMessageId)
				.single();

			if (existing) {
				return json({
					message: {
						id: existing.client_message_id ?? String(existing.id),
						role: existing.role,
						content: existing.content,
						toolName: existing.tool_name,
						createdAt: existing.created_at
					}
				});
			}
		}
		return json({ error: 'Failed to persist message' }, { status: 500 });
	}

	// Update thread last_message_at
	await locals.supabase
		.from('chat_threads')
		.update({ last_message_at: new Date().toISOString() })
		.eq('id', threadId);

	return json({
		message: {
			id: inserted.client_message_id ?? String(inserted.id),
			role: inserted.role,
			content: inserted.content,
			toolName: inserted.tool_name,
			createdAt: inserted.created_at
		}
	});
};
