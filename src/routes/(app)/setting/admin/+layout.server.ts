import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent }) => {
	const parentData = await parent();
	const permissions = (parentData as { permissions?: Record<string, boolean> }).permissions ?? {};

	if (!permissions['admin']) {
		error(403, 'Forbidden: admin access required');
	}
};
