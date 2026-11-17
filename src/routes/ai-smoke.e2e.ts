import { expect, test, signIn } from '../../tests/e2e/fixtures';

const disabledMessage =
	'AI is not configured. An administrator must set the AI Base URL and Model Name in Settings > Admin > Preferences.';

test.describe('AI disabled fixture', () => {
	test('AI controls are absent on records and patient detail', async ({ page, testPatient }) => {
		await signIn(page);
		for (const path of ['/record', `/record/${testPatient.id}`]) {
			const response = await page.goto(path);
			expect(response?.status()).toBe(200);
			await expect(page.getByRole('button', { name: 'AI Chat', exact: true })).toHaveCount(0);
			await expect(page.getByRole('button', { name: /Summarize/ })).toHaveCount(0);
			await expect(page.getByText('AI Assistant', { exact: true })).toHaveCount(0);
		}
	});

	for (const suffix of ['', '?stream=true']) {
		test(`authorized chat returns 503 when disabled (${suffix || 'non-streaming'})`, async ({
			page
		}) => {
			await signIn(page, 'editor');
			const response = await page.request.post(`/api/v1/ai/chat${suffix}`, {
				maxRedirects: 0,
				headers: { Accept: 'application/json' },
				data: { messages: [{ role: 'user', content: 'hello' }], context: {} }
			});
			expect(response.status()).toBe(503);
			expect(await response.json()).toEqual({ message: disabledMessage });
			expect(response.headers()['cache-control']).toBe('no-store');
		});
	}

	test('signed-out chat is 401 before configuration is checked', async ({ request }) => {
		const response = await request.post('/api/v1/ai/chat?stream=true', {
			maxRedirects: 0,
			headers: { Accept: 'application/json' },
			data: {}
		});
		expect(response.status()).toBe(401);
		expect(await response.json()).toEqual({ message: 'Unauthorized' });
	});

	test('reader without ai.chat receives 403 before configuration is checked', async ({ page }) => {
		await signIn(page, 'reader');
		const response = await page.request.post('/api/v1/ai/chat?stream=true', {
			maxRedirects: 0,
			headers: { Accept: 'application/json' },
			data: {}
		});
		expect(response.status()).toBe(403);
		expect(await response.json()).toEqual({ message: 'Forbidden: missing permission "ai.chat"' });
	});
});
