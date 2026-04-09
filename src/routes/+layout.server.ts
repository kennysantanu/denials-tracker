import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { session }, depends }) => {
	depends('supabase:auth');

	return {
		session
	};
};
