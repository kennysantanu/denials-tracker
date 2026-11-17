import { defineConfig } from '@playwright/test';
import { loadTestEnvironment } from './tests/e2e/environment';

loadTestEnvironment();

export default defineConfig({
	testMatch: ['src/**/*.e2e.{ts,js}', 'tests/**/*.e2e.ts'],
	globalSetup: './tests/e2e/global-setup.ts',
	globalTeardown: './tests/e2e/global-teardown.ts',
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: 0,
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL: 'http://127.0.0.1:4173',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	webServer: {
		command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
		url: 'http://127.0.0.1:4173/api/health',
		timeout: 120_000,
		reuseExistingServer: false
	}
});
