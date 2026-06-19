import { error } from '@sveltejs/kit';
import { loadEffectivePermissions } from '$lib/server/authz';
import type { LayoutServerLoad } from './$types';

const ADMIN_KEYS = [
	'user.read',
	'role.read',
	'audit.read',
	'audit.export',
	'label.read',
	'system_preferences.read',
	'break_glass.admin'
] as const;

export const load: LayoutServerLoad = async (event) => {
	const effective = await loadEffectivePermissions(event);
	const hasAdminAccess = ADMIN_KEYS.some((k) => effective[k] === true);

	if (!hasAdminAccess) {
		error(403, 'Forbidden: admin access required');
	}
};
