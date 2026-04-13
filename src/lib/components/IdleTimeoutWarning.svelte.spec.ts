import { page } from 'vitest/browser';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import IdleTimeoutWarning from './IdleTimeoutWarning.svelte';

// Mock SvelteKit modules
vi.mock('$app/forms', () => ({
	enhance: () => () => {}
}));

describe('IdleTimeoutWarning.svelte', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('does not show warning initially', async () => {
		render(IdleTimeoutWarning);

		await expect.element(page.getByText('Session Expiring')).not.toBeInTheDocument();
	});

	it('renders hidden signout form', async () => {
		render(IdleTimeoutWarning);

		const form = document.getElementById('idle-signout-form');
		expect(form).not.toBeNull();
		expect(form?.getAttribute('action')).toBe('/signout');
	});

	it('shows warning after idle timeout minus warning period', async () => {
		render(IdleTimeoutWarning);

		// Default 15 min timeout, 2 min warning → warning at 13 min
		vi.advanceTimersByTime(13 * 60 * 1000 + 100);

		await expect.element(page.getByText('Session Expiring')).toBeInTheDocument();
	});

	it('respects custom timeoutMinutes prop', async () => {
		render(IdleTimeoutWarning, { props: { timeoutMinutes: 10 } });

		// 10 min timeout - 2 min warning = 8 min
		vi.advanceTimersByTime(8 * 60 * 1000 + 100);

		await expect.element(page.getByText('Session Expiring')).toBeInTheDocument();
	});

	it('does not show warning before custom timeout threshold', async () => {
		render(IdleTimeoutWarning, { props: { timeoutMinutes: 10 } });

		// 7 min is before the 8 min warning threshold
		vi.advanceTimersByTime(7 * 60 * 1000);

		await expect.element(page.getByText('Session Expiring')).not.toBeInTheDocument();
	});

	it('shows Continue Session button in warning dialog', async () => {
		render(IdleTimeoutWarning);

		vi.advanceTimersByTime(13 * 60 * 1000 + 100);

		await expect.element(page.getByText('Continue Session')).toBeInTheDocument();
	});

	it('shows Sign Out Now button in warning dialog', async () => {
		render(IdleTimeoutWarning);

		vi.advanceTimersByTime(13 * 60 * 1000 + 100);

		await expect.element(page.getByText('Sign Out Now')).toBeInTheDocument();
	});

	it('sets last activity in localStorage', async () => {
		render(IdleTimeoutWarning);

		const storedVal = localStorage.getItem('denials_tracker_last_activity');
		expect(storedVal).not.toBeNull();
	});

	it('hides warning after Continue Session is clicked', async () => {
		render(IdleTimeoutWarning);

		// Trigger warning
		vi.advanceTimersByTime(13 * 60 * 1000 + 100);

		await expect.element(page.getByText('Session Expiring')).toBeInTheDocument();

		// Click Continue Session
		await page.getByText('Continue Session').click();

		await expect.element(page.getByText('Session Expiring')).not.toBeInTheDocument();
	});
});
