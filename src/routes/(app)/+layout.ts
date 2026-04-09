import { invalidate } from '$app/navigation';
import { createSupabaseBrowserClient } from '$lib/supabaseClient';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data, depends }) => {
	depends('supabase:auth');

	const supabase = createSupabaseBrowserClient();

	return {
		...data,
		supabase
	};
};
