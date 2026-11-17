import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { serviceClient, type Persona, type SeedManifest } from './fixtures';
import teardown from './global-teardown';

export default async function setup() {
	// Clean the previous run's recorded identities after an interrupted test run.
	if (existsSync('.test-data/fixtures.json')) await teardown();
	const db = serviceClient();
	// Retained synthetic volumes must not accumulate IP lockouts between runs.
	const reset = await db.from('audit_log').delete().eq('action', 'login_failed');
	if (reset.error) throw reset.error;
	const { data: catalog, error: catalogError } = await db
		.from('permission_catalog')
		.select('key')
		.eq('is_active', true);
	if (catalogError) throw catalogError;
	if (!catalog?.length)
		throw new Error('Test database is not migrated: permission catalog is empty.');
	const permissions: Record<Persona, string[]> = {
		admin: catalog.map(({ key }) => key),
		editor: [
			'dashboard.read',
			'patient.read',
			'patient.create',
			'patient.update',
			'denial.read',
			'denial.create',
			'denial.update',
			'denial.close',
			'denial.reopen',
			'denial.delete',
			'note.create',
			'note.update',
			'file.read',
			'file.upload',
			'report.read',
			'ai.chat'
		],
		reader: ['dashboard.read', 'patient.read', 'denial.read', 'file.read', 'report.read'],
		denied: []
	};
	const bucket = await db.storage.getBucket('files');
	if (bucket.error) throw new Error(`Migrated files bucket missing: ${bucket.error.message}`);
	if (bucket.data.public) throw new Error('Test files bucket must be private.');
	const run = randomUUID();
	const seed: SeedManifest = { users: {} as SeedManifest['users'], roleIds: [] };
	mkdirSync('.test-data', { recursive: true, mode: 0o700 });
	const save = () =>
		writeFileSync('.test-data/fixtures.json', JSON.stringify(seed), { mode: 0o600 });
	save();
	try {
		for (const persona of Object.keys(permissions) as Persona[]) {
			const { data: role, error: roleError } = await db
				.from('roles')
				.insert({ role_name: `test-${run}-${persona}` })
				.select('id')
				.single();
			if (roleError) throw roleError;
			seed.roleIds.push(role.id);
			save();
			if (permissions[persona].length) {
				const { error } = await db
					.from('role_permissions')
					.insert(
						permissions[persona].map((permission_key) => ({ role_id: role.id, permission_key }))
					);
				if (error) throw error;
			}
			const email = `${persona}-${run}@example.test`;
			const password = `Test!9-${randomUUID()}`;
			const { data, error } = await db.auth.admin.createUser({
				email,
				password,
				email_confirm: true,
				user_metadata: { username: `test-${persona}` }
			});
			if (error) throw error;
			seed.users[persona] = { email, password, id: data.user.id };
			save();
			const { error: assignmentError } = await db
				.from('user_role_assignments')
				.insert({ user_id: data.user.id, role_id: role.id, reason: 'Synthetic test fixture' });
			if (assignmentError) throw assignmentError;
		}
		const { error } = await db.from('preferences').upsert(
			[
				{ name: 'ai_enabled', data_type: 'boolean', value: 'false' },
				{ name: 'ai_base_url', data_type: 'string', value: '' },
				{ name: 'ai_model_name', data_type: 'string', value: '' },
				{ name: 'wiki_enabled', data_type: 'boolean', value: 'false' }
			],
			{ onConflict: 'name' }
		);
		if (error) throw error;
	} catch (error) {
		await teardown();
		throw error;
	}
}
