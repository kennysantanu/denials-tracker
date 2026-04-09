<script lang="ts">
	import { enhance } from '$app/forms';
	// Idle timeout in ms (default: 15 minutes)
	const TIMEOUT_MS = 15 * 60 * 1000;
	const WARNING_MS = 2 * 60 * 1000; // 2-minute warning
	const STORAGE_KEY = 'denials_tracker_last_activity';

	let showWarning = $state(false);
	let secondsLeft = $state(120);
	let warningInterval: ReturnType<typeof setInterval> | null = null;
	let idleTimer: ReturnType<typeof setTimeout> | null = null;
	let warningTimer: ReturnType<typeof setTimeout> | null = null;

	function getLastActivity(): number {
		try {
			const val = localStorage.getItem(STORAGE_KEY);
			return val ? parseInt(val, 10) : Date.now();
		} catch {
			return Date.now();
		}
	}

	function setLastActivity() {
		try {
			localStorage.setItem(STORAGE_KEY, String(Date.now()));
		} catch {
			// Ignore storage errors
		}
	}

	function resetTimers() {
		showWarning = false;
		secondsLeft = 120;

		if (warningInterval) clearInterval(warningInterval);
		if (idleTimer) clearTimeout(idleTimer);
		if (warningTimer) clearTimeout(warningTimer);

		setLastActivity();

		// Schedule warning at TIMEOUT_MS - WARNING_MS
		warningTimer = setTimeout(() => {
			showWarning = true;
			secondsLeft = Math.floor(WARNING_MS / 1000);

			warningInterval = setInterval(() => {
				secondsLeft--;
				if (secondsLeft <= 0) {
					triggerSignOut();
				}
			}, 1000);
		}, TIMEOUT_MS - WARNING_MS);

		// Schedule auto-signout at TIMEOUT_MS
		idleTimer = setTimeout(() => {
			triggerSignOut();
		}, TIMEOUT_MS);
	}

	function triggerSignOut() {
		// Submit the signout form
		const form = document.getElementById('idle-signout-form') as HTMLFormElement | null;
		if (form) {
			form.requestSubmit();
		}
	}

	function handleActivity() {
		// Check cross-tab: if another tab updated recently, reset
		const lastActivity = getLastActivity();
		const elapsed = Date.now() - lastActivity;

		if (elapsed < TIMEOUT_MS - WARNING_MS) {
			resetTimers();
		}
	}

	function continueSession() {
		resetTimers();
	}

	// Cross-tab sync: listen for storage changes
	function handleStorageEvent(e: StorageEvent) {
		if (e.key === STORAGE_KEY) {
			resetTimers();
		}
	}

	import { onMount } from 'svelte';

	onMount(() => {
		resetTimers();

		const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
		events.forEach((event) => document.addEventListener(event, handleActivity));
		window.addEventListener('storage', handleStorageEvent);

		return () => {
			events.forEach((event) => document.removeEventListener(event, handleActivity));
			window.removeEventListener('storage', handleStorageEvent);
			if (warningInterval) clearInterval(warningInterval);
			if (idleTimer) clearTimeout(idleTimer);
			if (warningTimer) clearTimeout(warningTimer);
		};
	});
</script>

<!-- Hidden signout form -->
<form id="idle-signout-form" method="POST" action="/signout" use:enhance class="hidden"></form>

{#if showWarning}
	<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
		<div class="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
			<h2 class="text-lg font-semibold text-surface-900">Session Expiring</h2>
			<p class="mt-2 text-sm text-surface-600">
				Your session will expire in <strong>{secondsLeft}</strong> seconds due to inactivity.
			</p>
			<div class="mt-4 flex justify-end gap-3">
				<form method="POST" action="/signout" use:enhance>
					<button
						type="submit"
						class="rounded-md px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-100"
					>
						Sign Out Now
					</button>
				</form>
				<button
					onclick={continueSession}
					class="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
				>
					Continue Session
				</button>
			</div>
		</div>
	</div>
{/if}
