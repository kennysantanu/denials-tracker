import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const user = await locals.getUser();
	if (!user) {
		error(401, 'Unauthorized');
	}

	const id = parseInt(params.id, 10);
	if (isNaN(id) || id <= 0) {
		error(400, 'Invalid denial ID');
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}

	const { follow_up_date } =
		body != null && typeof body === 'object' ? (body as Record<string, unknown>) : {};

	if (follow_up_date !== null && follow_up_date !== undefined) {
		if (typeof follow_up_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(follow_up_date)) {
			error(400, 'Invalid date format. Expected YYYY-MM-DD');
		}
	}

	const { error: dbError } = await locals.supabase
		.from('denials')
		.update({ follow_up_date: (follow_up_date as string) ?? null })
		.eq('id', id);

	if (dbError) {
		error(500, dbError.message);
	}

	return json({ success: true });
};
