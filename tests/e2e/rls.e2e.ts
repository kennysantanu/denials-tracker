import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';

test('RLS lets readers read but not create or change patient records', async ({
	readerDb,
	dbAdmin,
	testPatient
}) => {
	const visible = await readerDb.from('patients').select('id').eq('id', testPatient.id);
	expect(visible.error).toBeNull();
	expect(visible.data).toEqual([{ id: testPatient.id }]);
	const insert = await readerDb
		.from('patients')
		.insert({ first_name: 'Forbidden', last_name: 'Synthetic', date_of_birth: '1990-01-01' });
	expect(insert.error?.code).toBe('42501');
	const update = await readerDb
		.from('patients')
		.update({ first_name: 'Forbidden' })
		.eq('id', testPatient.id)
		.select('id');
	expect(update.error).toBeNull();
	expect(update.data).toEqual([]);
	const persisted = await dbAdmin
		.from('patients')
		.select('first_name')
		.eq('id', testPatient.id)
		.single();
	expect(persisted.error).toBeNull();
	expect(persisted.data?.first_name).toBe('Synthetic');
});

test('RLS hides patient and denial data from users without grants', async ({
	deniedDb,
	dbAdmin,
	testPatient
}) => {
	const { data: denial, error } = await dbAdmin
		.from('denials')
		.insert({ patient_id: testPatient.id, service_start_date: '2026-01-01' })
		.select('id')
		.single();
	expect(error).toBeNull();
	for (const table of ['patients', 'denials'] as const) {
		const result = await deniedDb
			.from(table)
			.select('id')
			.eq('id', table === 'patients' ? testPatient.id : denial!.id);
		expect(result.error).toBeNull();
		expect(result.data).toEqual([]);
	}
});

test('private attachments require file.read and signed access', async ({
	dbAdmin,
	editorDb,
	readerDb,
	deniedDb
}) => {
	const path = `test-${randomUUID()}/synthetic.txt`;
	const uploaded = await editorDb.storage
		.from('files')
		.upload(path, Buffer.from('Synthetic test attachment'), { contentType: 'text/plain' });
	expect(uploaded.error).toBeNull();
	try {
		const refusedPath = `test-${randomUUID()}/reader.txt`;
		const refused = await readerDb.storage
			.from('files')
			.upload(refusedPath, Buffer.from('Forbidden'));
		try {
			expect(refused.error?.message).toMatch(/row.level security/i);
		} finally {
			const cleanup = await dbAdmin.storage.from('files').remove([refusedPath]);
			expect(cleanup.error).toBeNull();
		}
		const denied = await deniedDb.storage.from('files').createSignedUrl(path, 60);
		expect(denied.error).not.toBeNull();
		const signed = await editorDb.storage.from('files').createSignedUrl(path, 60);
		expect(signed.error).toBeNull();
		expect(signed.data?.signedUrl).toBeTruthy();
		const response = await fetch(signed.data!.signedUrl);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe('Synthetic test attachment');
		const publicResponse = await fetch(
			`${process.env.PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${path}`
		);
		expect(publicResponse.status).toBe(400);
		expect(await publicResponse.json()).toMatchObject({ message: 'Bucket not found' });
	} finally {
		const { error } = await dbAdmin.storage.from('files').remove([path]);
		expect(error).toBeNull();
	}
});
