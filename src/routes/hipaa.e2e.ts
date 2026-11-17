import { expect, test, signIn } from '../../tests/e2e/fixtures';

test.describe('HIPAA security controls', () => {
	test('patient pages and API responses cannot be cached', async ({ page }) => {
		await signIn(page);
		for (const path of ['/record', '/api/health']) {
			const response = await page.request.get(path, { maxRedirects: 0 });
			expect(response.status()).toBe(200);
			expect(response.headers()['cache-control']).toBe('no-store');
		}
	});

	test('signed-out audit export is exactly 401, not a followed sign-in page', async ({
		request
	}) => {
		const response = await request.get('/api/v1/audit/export', {
			maxRedirects: 0,
			headers: { Accept: 'application/json' }
		});
		expect(response.status()).toBe(401);
		expect(await response.json()).toEqual({ message: 'Unauthorized' });
		expect(response.headers()['cache-control']).toBe('no-store');
	});

	test('security headers protect the sign-in page', async ({ request }) => {
		const response = await request.get('/signin', { maxRedirects: 0 });
		expect(response.status()).toBe(200);
		const headers = response.headers();
		expect(headers['x-content-type-options']).toBe('nosniff');
		expect(headers['x-frame-options']).toBe('DENY');
		expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
		expect(headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
	});

	test('idle signout form posts to signout', async ({ page }) => {
		await signIn(page);
		const form = page.locator('#idle-signout-form');
		await expect(form).toBeAttached();
		await expect(form).toHaveAttribute('action', '/signout');
		await expect(form).toHaveAttribute('method', 'POST');
	});

	test('reader cannot view or export audit logs', async ({ page }) => {
		await signIn(page, 'reader');
		const view = await page.request.get('/setting/admin/audit', { maxRedirects: 0 });
		expect(view.status()).toBe(403);
		const exported = await page.request.get('/api/v1/audit/export', {
			maxRedirects: 0,
			headers: { Accept: 'application/json' }
		});
		expect(exported.status()).toBe(403);
		expect(await exported.json()).toEqual({
			message: 'Forbidden: missing permission "audit.export"'
		});
	});

	test('admin can view and export audit logs without caching PHI', async ({ page }) => {
		await signIn(page, 'admin');
		const view = await page.request.get('/setting/admin/audit', { maxRedirects: 0 });
		expect(view.status()).toBe(200);
		expect(view.headers()['cache-control']).toBe('no-store');
		const exported = await page.request.get('/api/v1/audit/export', { maxRedirects: 0 });
		expect(exported.status()).toBe(200);
		expect(exported.headers()['cache-control']).toBe('no-store');
		expect(exported.headers()['content-type']).toBe('text/csv; charset=utf-8');
		expect((await exported.text()).split('\n')[0]).toBe(
			'id,created_at,user_id,action,resource_type,resource_id,ip_address,user_agent,details'
		);
	});
});
