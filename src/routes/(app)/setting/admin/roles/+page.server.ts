import { fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { logAudit } from '$lib/server/audit';
import { logAppEvent } from '$lib/server/appEvents';
import { requirePermission } from '$lib/server/authz';
import { getRoles, createRole, deleteRole } from '$lib/server/db/roles';
import {
	getPermissionCatalog,
	setRolePermissions
} from '$lib/server/db/rolePermissions';
import type { PageServerLoad, Actions } from './$types';

// The form posts a comma-separated `keys` string of canonical permission
// keys (sourced from `permission_catalog`). The server validates against the
// catalog, then dual-writes via `setRolePermissions` (canonical rows in
// `role_permissions` plus the derived legacy `roles.permissions` JSON).
const createRoleSchema = z.object({
	role_name: z.string().min(1, 'Role name is required'),
	keys: z.string().default('')
});

const updateRoleSchema = z.object({
	id: z.coerce.number(),
	role_name: z.string().min(1, 'Role name is required'),
	keys: z.string().default('')
});

function parseKeys(raw: string): string[] {
	return [
		...new Set(
			raw
				.split(',')
				.map((s) => s.trim())
				.filter((s) => s.length > 0)
		)
	];
}

async function findUnknownKeys(
	supabase: Parameters<typeof getPermissionCatalog>[0],
	keys: string[]
): Promise<string[]> {
	if (keys.length === 0) return [];
	const { data: known } = await supabase
		.from('permission_catalog')
		.select('key')
		.in('key', keys);
	const knownSet = new Set((known ?? []).map((r) => r.key));
	return keys.filter((k) => !knownSet.has(k));
}

export const load: PageServerLoad = async (event) => {
	const { locals } = event;
	const user = await locals.getUser();
	if (!user) redirect(303, '/signin');

	await requirePermission(event, 'role.read', { resourceType: 'role' });

	const [{ data: roles }, { data: catalog }, { data: rolePerms }, { data: compat }] =
		await Promise.all([
			getRoles(locals.supabase),
			getPermissionCatalog(locals.supabase),
			locals.supabase.from('role_permissions').select('role_id, permission_key'),
			locals.supabase
				.from('permission_compatibility_map')
				.select('permission_key, legacy_key, direction, is_active')
		]);

	const grantsByRole = new Map<number, string[]>();
	for (const rp of rolePerms ?? []) {
		if (!grantsByRole.has(rp.role_id)) grantsByRole.set(rp.role_id, []);
		grantsByRole.get(rp.role_id)!.push(rp.permission_key);
	}

	const rolesWithGrants = (roles ?? []).map((r) => ({
		...r,
		canonicalKeys: grantsByRole.get(r.id) ?? []
	}));

	// Map canonical key -> legacy keys it maps to (active rows only). Catalog
	// entries with at least one mapping are 'legacy-mapped'; the rest are
	// 'new'. FK on permission_compatibility_map.permission_key precludes a
	// 'legacy-only' kind here.
	const legacyByKey = new Map<string, string[]>();
	for (const row of compat ?? []) {
		if (!row.is_active) continue;
		if (!legacyByKey.has(row.permission_key)) legacyByKey.set(row.permission_key, []);
		legacyByKey.get(row.permission_key)!.push(row.legacy_key);
	}

	const catalogWithKind = (catalog ?? []).map((c) => ({
		...c,
		kind: (legacyByKey.get(c.key)?.length ?? 0) > 0
			? ('legacy-mapped' as const)
			: ('new' as const),
		legacyKeys: legacyByKey.get(c.key) ?? []
	}));

	const createForm = await superValidate(zod(createRoleSchema));
	const updateForm = await superValidate(zod(updateRoleSchema));

	return {
		roles: rolesWithGrants,
		catalog: catalogWithKind,
		createForm,
		updateForm
	};
};

export const actions: Actions = {
	createRole: async (event) => {
		const { request, locals } = event;
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		await requirePermission(event, 'role.create', { resourceType: 'role' });

		const form = await superValidate(request, zod(createRoleSchema));
		if (!form.valid) return fail(400, { createForm: form });

		const keys = parseKeys(form.data.keys);
		const unknown = await findUnknownKeys(locals.supabase, keys);
		if (unknown.length > 0) {
			return fail(400, {
				createForm: form,
				error: `Unknown permission keys: ${unknown.join(', ')}`
			});
		}

		const { data: role, error } = await createRole(locals.supabase, {
			role_name: form.data.role_name,
			permissions: {} // legacy mirror is rewritten by setRolePermissions
		});
		if (error || !role) {
			return fail(500, { createForm: form, error: error?.message ?? 'Failed to create role' });
		}

		const { error: setError } = await setRolePermissions(
			locals.supabase,
			role.id,
			keys,
			user.id
		);
		if (setError) return fail(500, { createForm: form, error: setError.message });

		logAudit(
			locals.supabase,
			user.id,
			'create',
			'role',
			String(role.id),
			{ role_name: form.data.role_name, canonical_keys: keys },
			request
		);
		logAppEvent(locals.supabase, {
			eventName: 'role.create',
			featureArea: 'admin.roles',
			outcome: 'success',
			actorUserId: user.id,
			permissionKey: 'role.create',
			permissionSource: 'new',
			resourceType: 'role',
			resourceId: String(role.id),
			requestId: locals.requestId,
			metadata: { role_name: form.data.role_name, canonical_keys: keys }
		});

		return message(form, 'Role created successfully');
	},

	updateRole: async (event) => {
		const { request, locals } = event;
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		await requirePermission(event, 'role.update', { resourceType: 'role' });

		const form = await superValidate(request, zod(updateRoleSchema));
		if (!form.valid) return fail(400, { updateForm: form });

		const keys = parseKeys(form.data.keys);
		const unknown = await findUnknownKeys(locals.supabase, keys);
		if (unknown.length > 0) {
			return fail(400, {
				updateForm: form,
				error: `Unknown permission keys: ${unknown.join(', ')}`
			});
		}

		const { id, role_name } = form.data;

		const { error: nameError } = await locals.supabase
			.from('roles')
			.update({ role_name })
			.eq('id', id);
		if (nameError) return fail(500, { updateForm: form, error: nameError.message });

		const { error: setError } = await setRolePermissions(locals.supabase, id, keys, user.id);
		if (setError) return fail(500, { updateForm: form, error: setError.message });

		logAudit(
			locals.supabase,
			user.id,
			'update',
			'role',
			String(id),
			{ role_name, canonical_keys: keys },
			request
		);
		logAppEvent(locals.supabase, {
			eventName: 'role.update',
			featureArea: 'admin.roles',
			outcome: 'success',
			actorUserId: user.id,
			permissionKey: 'role.update',
			permissionSource: 'new',
			resourceType: 'role',
			resourceId: String(id),
			requestId: locals.requestId,
			metadata: { role_name, canonical_keys: keys }
		});

		return message(form, 'Role updated successfully');
	},

	deleteRole: async (event) => {
		const { request, locals } = event;
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		await requirePermission(event, 'role.delete', { resourceType: 'role' });

		const formData = await request.formData();
		const id = Number(formData.get('id'));
		if (!id) return fail(400, { error: 'Invalid role ID' });

		const { error } = await deleteRole(locals.supabase, id);
		if (error) {
			// Phase 1 trigger raises foreign_key_violation when a role is still
			// assigned. Translate to a friendly message for the UI.
			const friendly = /still referenced|foreign key|in use|violates/i.test(error.message)
				? 'Cannot delete a role that is still assigned to one or more users.'
				: error.message;
			return fail(409, { error: friendly });
		}

		logAudit(locals.supabase, user.id, 'delete', 'role', String(id), undefined, request);
		logAppEvent(locals.supabase, {
			eventName: 'role.delete',
			featureArea: 'admin.roles',
			outcome: 'success',
			actorUserId: user.id,
			permissionKey: 'role.delete',
			permissionSource: 'new',
			resourceType: 'role',
			resourceId: String(id),
			requestId: locals.requestId
		});

		return { success: true };
	}
};
