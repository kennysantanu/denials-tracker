import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isAIConfigured } from '$lib/server/ai/client';

export const GET: RequestHandler = async ({ locals }) => {
	const configured = await isAIConfigured(locals.supabase);
	return json({ configured });
};
