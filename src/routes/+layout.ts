import { createSupabaseBrowserClient } from '$lib/supabaseClient';
import { invalidate } from '$app/navigation';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data, depends }) => {
	depends('supabase:auth');

	const supabase = createSupabaseBrowserClient();

	const {
		data: { session }
	} = await supabase.auth.getSession();

	return {
		supabase,
		session: data.session ?? session
	};
};
