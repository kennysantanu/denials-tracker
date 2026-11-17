import { existsSync, unlinkSync } from 'node:fs';
import { manifest, serviceClient } from './fixtures';

export default async function teardown() {
	if (!existsSync('.test-data/fixtures.json')) return;
	const seed = manifest();
	const db = serviceClient();
	for (const { id } of Object.values(seed.users)) {
		const { error } = await db.auth.admin.deleteUser(id);
		if (error && error.status !== 404) throw error;
	}
	if (seed.roleIds.length) {
		const { error } = await db.from('roles').delete().in('id', seed.roleIds);
		if (error) throw error;
	}
	unlinkSync('.test-data/fixtures.json');
}
