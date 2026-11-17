import { test, expect, signIn } from '../../tests/e2e/fixtures';

test('editor creates, updates, closes and deletes a denial with persisted notes and audit', async ({
	page,
	testPatient,
	dbAdmin
}) => {
	await signIn(page);
	await page.goto(`/record/${testPatient.id}`);
	await expect(page.getByRole('heading', { name: /^Open Claims/ })).toBeVisible();
	await page.getByRole('button', { name: 'New Denial' }).click();
	await page.locator('input[name="service_start_date"]').fill('2026-01-10');
	await page.locator('input[name="billed_amount"]').fill('250.50');
	await page
		.locator('textarea[name="initial_note"]')
		.fill('Synthetic denial reason for automated testing');
	await page.getByRole('button', { name: 'Create Denial', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Create Denial', exact: true })).not.toBeVisible();
	const readDenials = () => dbAdmin.from('denials').select('*').eq('patient_id', testPatient.id);
	await expect.poll(async () => (await readDenials()).data?.length).toBe(1);
	const { data: denials, error } = await readDenials();
	expect(error).toBeNull();
	const denial = denials![0];
	expect(denial.billed_amount).toBe(250.5);
	const notes = await dbAdmin.from('notes').select('note').eq('denial_id', denial.id);
	expect(notes.error).toBeNull();
	expect(notes.data).toEqual([{ note: 'Synthetic denial reason for automated testing' }]);
	await page.getByTitle('Actions', { exact: true }).click();
	await page.getByRole('button', { name: 'Edit', exact: true }).click();
	await page.locator('input[name="paid_amount"]').fill('100');
	await page.locator('input[name="is_closed"]').check();
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect.poll(async () => (await readDenials()).data?.[0]?.is_closed).toBe(true);
	expect((await readDenials()).data?.[0]?.paid_amount).toBe(100);
	await page.getByRole('button', { name: /Closed Claims/ }).click();
	await page.getByTitle('Actions', { exact: true }).click();
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect.poll(async () => (await readDenials()).data?.length).toBe(0);
	await expect
		.poll(async () => {
			const result = await dbAdmin
				.from('audit_log')
				.select('action')
				.eq('resource_type', 'denial')
				.eq('resource_id', String(denial.id));
			if (result.error) throw result.error;
			return result.data.map((row) => row.action);
		})
		.toEqual(expect.arrayContaining(['create', 'update', 'delete']));
	await expect
		.poll(async () => {
			const result = await dbAdmin
				.from('app_events')
				.select('subject_denial_id, subject_patient_id')
				.eq('event_name', 'denial.deleted')
				.eq('resource_id', String(denial.id));
			if (result.error) throw result.error;
			return result.data;
		})
		.toEqual([{ subject_denial_id: null, subject_patient_id: testPatient.id }]);
});

test('reader cannot create a denial through UI or direct form submission', async ({
	page,
	testPatient,
	dbAdmin
}) => {
	await signIn(page, 'reader');
	await page.goto(`/record/${testPatient.id}`);
	await expect(page.getByRole('button', { name: 'New Denial' })).not.toBeVisible();
	const response = await page.request.post(`/record/${testPatient.id}?/createDenial`, {
		form: { service_start_date: '2026-01-10', initial_note: 'Must not persist' },
		headers: { Origin: 'http://127.0.0.1:4173' }
	});
	expect(response.status()).toBe(403);
	const result = await dbAdmin.from('denials').select('id').eq('patient_id', testPatient.id);
	expect(result.error).toBeNull();
	expect(result.data).toEqual([]);
});
