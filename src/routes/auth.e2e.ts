import { expect, test } from '@playwright/test';

/**
 * E2E: Auth flow
 * Prerequisites: A running app with at least one user account.
 * Environment variables TEST_USER_EMAIL and TEST_USER_PASSWORD must be set.
 */

const EMAIL = process.env.TEST_USER_EMAIL ?? 'admin@example.com';
const PASSWORD = process.env.TEST_USER_PASSWORD ?? 'TestP@ssw0rd123!';

test.describe('Auth flow', () => {
	test('unauthenticated user is redirected to /signin', async ({ page }) => {
		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/signin/);
	});

	test('sign in page renders email and password fields', async ({ page }) => {
		await page.goto('/signin');

		await expect(page.locator('input[name="email"]')).toBeVisible();
		await expect(page.locator('input[name="password"]')).toBeVisible();
	});

	test('sign in with invalid credentials shows error', async ({ page }) => {
		await page.goto('/signin');

		await page.fill('input[name="email"]', 'invalid@example.com');
		await page.fill('input[name="password"]', 'wrongpassword1');
		await page.click('button[type="submit"]');

		// Should stay on signin page with error
		await expect(page).toHaveURL(/\/signin/);
	});

	test('sign in with valid credentials redirects to dashboard', async ({ page }) => {
		await page.goto('/signin');

		await page.fill('input[name="email"]', EMAIL);
		await page.fill('input[name="password"]', PASSWORD);
		await page.click('button[type="submit"]');

		// Should redirect to dashboard
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
	});

	test('sign out redirects to signin', async ({ page }) => {
		// Sign in first
		await page.goto('/signin');
		await page.fill('input[name="email"]', EMAIL);
		await page.fill('input[name="password"]', PASSWORD);
		await page.click('button[type="submit"]');
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

		// Sign out
		await page.click('text=Sign Out');
		await expect(page).toHaveURL(/\/signin/, { timeout: 10000 });
	});

	test('accessing protected route after sign-out redirects', async ({ page }) => {
		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/signin/);
	});

	test('session timeout warning elements exist on protected pages', async ({ page }) => {
		// Sign in
		await page.goto('/signin');
		await page.fill('input[name="email"]', EMAIL);
		await page.fill('input[name="password"]', PASSWORD);
		await page.click('button[type="submit"]');
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

		// Idle timeout form should be present (hidden)
		const signoutForm = page.locator('#idle-signout-form');
		await expect(signoutForm).toBeAttached();
	});
});
