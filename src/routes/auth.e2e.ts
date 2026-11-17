import { expect, test, signIn } from '../../tests/e2e/fixtures';

test.describe('Authentication', () => {
	test('signed-out protected request preserves its deep link', async ({ request }) => {
		const response = await request.get('/dashboard?from=auth-test', { maxRedirects: 0 });
		expect(response.status()).toBe(303);
		expect(response.headers()['location']).toBe(
			'/signin?redirectTo=%2Fdashboard%3Ffrom%3Dauth-test'
		);
	});

	test('invalid credentials display an error without authenticating', async ({ page }) => {
		await page.goto('/signin');
		await page.getByRole('textbox', { name: 'Email' }).fill('invalid@example.com');
		await page.locator('input[name="password"]').fill('wrongpassword1');
		await page.locator('button[type="submit"]').click();
		await expect(page.getByText('Invalid email or password.', { exact: true })).toBeVisible();
		await expect(page).toHaveURL(/\/signin$/);
		const response = await page.request.get('/api/v1/audit/export', { maxRedirects: 0 });
		expect(response.status()).toBe(401);
	});

	test('valid sign-in reaches records and sign-out revokes access', async ({ page }) => {
		await signIn(page);
		await expect(page).toHaveURL(/\/record$/);
		await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
		await expect(page).toHaveURL(/\/signin$/);
		const protectedResponse = await page.request.get('/dashboard', { maxRedirects: 0 });
		expect(protectedResponse.status()).toBe(303);
		expect(protectedResponse.headers()['location']).toBe('/signin?redirectTo=%2Fdashboard');
		const apiResponse = await page.request.get('/api/v1/audit/export', { maxRedirects: 0 });
		expect(apiResponse.status()).toBe(401);
	});

	test('reader can read records', async ({ page }) => {
		await signIn(page, 'reader');
		const allowed = await page.request.get('/record', { maxRedirects: 0 });
		expect(allowed.status()).toBe(200);
	});

	test('ungranted user receives the patient.read denial', async ({ page }) => {
		await signIn(page, 'denied');
		// Page load errors render the HTML error boundary, not an API JSON response.
		const response = await page.goto('/record');
		expect(response?.status()).toBe(403);
		await expect(page.getByRole('heading', { name: '403', exact: true })).toBeVisible();
		await expect(
			page.getByText("You don't have permission to access this page.", { exact: true })
		).toBeVisible();
	});
});
