<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import IdleTimeoutWarning from '$lib/components/IdleTimeoutWarning.svelte';
	import AIChatDrawer from '$lib/components/ai/AIChatDrawer.svelte';
	import { Toast } from '@skeletonlabs/skeleton-svelte';
	import { toaster } from '$lib/toast';
	import {
		isChatDrawerOpen,
		toggleChatDrawer,
		setChatContext
	} from '$lib/stores/chatContext.svelte';

	let { data, children } = $props();

	let drawerOpen = $state(false);
	let closeButtonRef = $state<HTMLButtonElement>();
	let userMenuOpen = $state(false);

	const navItems = [
		{ href: '/dashboard', label: 'Dashboard', icon: '📊' },
		{ href: '/record', label: 'Record', icon: '📋' },
		{ href: '/file', label: 'Files', icon: '📁' },
		{ href: '/report', label: 'Report', icon: '📈' },
		{ href: '/setting', label: 'Settings', icon: '⚙️' }
	];

	const toastTypeIcons: Record<string, string> = {
		success: '✔',
		error: '✖',
		warning: '⚠',
		info: 'ℹ'
	};
	const toastTypeIconColors: Record<string, string> = {
		success: 'text-success-600',
		error: 'text-error-600',
		warning: 'text-warning-600',
		info: 'text-primary-600'
	};
	const toastTypeStyles: Record<string, string> = {
		success: 'border-l-4 border-l-success-500 bg-success-50',
		error: 'border-l-4 border-l-error-500 bg-error-50',
		warning: 'border-l-4 border-l-warning-500 bg-warning-50',
		info: 'border-l-4 border-l-primary-500 bg-primary-50'
	};

	let currentPath = $derived(page.url.pathname);
	let userInitial = $derived((data.user?.email?.[0] ?? '?').toUpperCase());

	function isActive(href: string): boolean {
		return currentPath === href || currentPath.startsWith(href + '/');
	}

	// AI chat button visibility: only on context-providing routes
	const aiContextRoutes = ['/dashboard', '/record', '/report'];
	let showAiButton = $derived(
		data.aiEnabled && aiContextRoutes.some((r) => currentPath === r || currentPath.startsWith(r))
	);

	// Update chat context when route changes
	$effect(() => {
		setChatContext({ route: currentPath });
	});

	function handleDrawerKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			drawerOpen = false;
		}
	}

	function handleUserMenuKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			userMenuOpen = false;
		}
	}

	$effect(() => {
		if (drawerOpen) {
			closeButtonRef?.focus();
		}
	});

	onMount(() => {
		const {
			data: { subscription }
		} = data.supabase.auth.onAuthStateChange((_event: string, _session: unknown) => {
			invalidate('supabase:auth');
		});

		return () => subscription.unsubscribe();
	});
</script>

<div class="flex h-screen flex-col overflow-hidden bg-surface-50">
	<!-- Top navbar -->
	<header class="flex-shrink-0 border-b border-surface-200 bg-white">
		<div class="flex h-16 items-center justify-between px-4 lg:px-8">
			<!-- Left: Hamburger (mobile) + Logo -->
			<div class="flex items-center gap-3">
				<button
					class="rounded-md p-2 text-surface-500 hover:bg-surface-100 lg:hidden"
					onclick={() => (drawerOpen = true)}
					aria-label="Open navigation"
				>
					<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 6h16M4 12h16M4 18h16"
						/>
					</svg>
				</button>
				<h1 class="text-lg font-bold text-primary-600">Denials Tracker</h1>
			</div>

			<!-- Center: Desktop nav -->
			<nav class="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex">
				{#each navItems as item (item.href)}
					<a
						href={item.href}
						aria-current={isActive(item.href) ? 'page' : undefined}
						class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors {isActive(
							item.href
						)
							? 'bg-primary-50 text-primary-700'
							: 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'}"
					>
						<span>{item.icon}</span>
						{item.label}
					</a>
				{/each}
			</nav>

			<!-- Right: User actions -->
			<div class="flex items-center gap-2">
				{#if showAiButton}
					<!-- Desktop-only AI Chat button -->
					<button
						type="button"
						onclick={toggleChatDrawer}
						class="hidden rounded-md transition-colors lg:block {isChatDrawerOpen()
							? 'bg-primary-100 px-3 py-1.5 text-primary-700'
							: 'px-3 py-1.5 text-surface-600 hover:bg-surface-100 hover:text-surface-900'}"
						title="AI Assistant"
					>
						<span class="text-sm font-medium">🤖 AI Chat</span>
					</button>
				{/if}

				<!-- Desktop: avatar + email + divider + sign out -->
				<div class="hidden items-center gap-2 lg:flex">
					<div class="flex items-center gap-2">
						<div
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700"
							aria-hidden="true"
						>
							{userInitial}
						</div>
						<span
							class="text-sm text-surface-600"
							aria-label="Signed in as {data.user?.email ?? ''}"
						>
							{data.user?.email ?? ''}
						</span>
					</div>
					<div class="h-5 w-px bg-surface-200" aria-hidden="true"></div>
					<form method="POST" action="/signout" use:enhance>
						<button
							type="submit"
							class="rounded-md px-3 py-1.5 text-sm font-medium text-surface-500 hover:bg-surface-100 hover:text-surface-900"
						>
							Sign Out
						</button>
					</form>
				</div>

				<!-- Mobile: avatar circle → dropdown -->
				<div class="relative lg:hidden">
					<button
						type="button"
						onclick={() => (userMenuOpen = !userMenuOpen)}
						class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700"
						aria-label="User menu"
						aria-expanded={userMenuOpen}
						aria-haspopup="true"
					>
						{userInitial}
					</button>

					{#if userMenuOpen}
						<!-- Backdrop -->
						<div
							role="presentation"
							class="fixed inset-0 z-10"
							onclick={() => (userMenuOpen = false)}
						></div>
						<!-- Dropdown -->
						<div
							class="absolute right-0 z-20 mt-2 w-52 rounded-lg border border-surface-200 bg-white py-1 shadow-lg"
							role="menu"
							tabindex="-1"
							onkeydown={handleUserMenuKeydown}
						>
							<!-- User info header -->
							<div class="border-b border-surface-100 px-4 py-2">
								<p class="truncate text-xs text-surface-500">{data.user?.email ?? ''}</p>
							</div>
							<!-- Actions -->
							{#if showAiButton}
								<button
									type="button"
									onclick={() => {
										toggleChatDrawer();
										userMenuOpen = false;
									}}
									class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-surface-700 hover:bg-surface-50"
									role="menuitem"
								>
									<span aria-hidden="true">🤖</span> AI Chat
								</button>
							{/if}
							<form method="POST" action="/signout" use:enhance>
								<button
									type="submit"
									class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-surface-700 hover:bg-surface-50"
									role="menuitem"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-4 w-4 shrink-0"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										aria-hidden="true"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
										/>
									</svg>
									Sign Out
								</button>
							</form>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</header>

	<!-- Mobile drawer overlay -->
	{#if drawerOpen}
		<div class="fixed inset-0 z-40 lg:hidden">
			<!-- Backdrop -->
			<div
				role="presentation"
				class="fixed inset-0 bg-black/50"
				onclick={() => (drawerOpen = false)}
			></div>
			<!-- Drawer -->
			<div
				class="fixed top-0 left-0 z-50 flex h-full w-64 flex-col bg-white shadow-xl"
				role="dialog"
				aria-modal="true"
				aria-label="Navigation menu"
				tabindex="-1"
				onkeydown={handleDrawerKeydown}
			>
				<div class="flex h-16 items-center justify-between border-b border-surface-200 px-6">
					<h1 class="text-lg font-bold text-primary-600">Denials Tracker</h1>
					<button
						bind:this={closeButtonRef}
						onclick={() => (drawerOpen = false)}
						class="rounded-md p-1 text-surface-400 hover:text-surface-600"
						aria-label="Close menu"
					>
						✕
					</button>
				</div>
				<nav class="flex-1 space-y-1 px-3 py-4">
					{#each navItems as item (item.href)}
						<a
							href={item.href}
							onclick={() => (drawerOpen = false)}
							aria-current={isActive(item.href) ? 'page' : undefined}
							class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors {isActive(
								item.href
							)
								? 'bg-primary-50 text-primary-700'
								: 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'}"
						>
							<span>{item.icon}</span>
							{item.label}
						</a>
					{/each}
				</nav>
			</div>
		</div>
	{/if}

	<!-- Page content -->
	<main class="flex-1 overflow-y-auto p-4 lg:p-8">
		{@render children()}
	</main>
</div>

<IdleTimeoutWarning timeoutMinutes={data.idleTimeoutMinutes} />

{#if data.aiEnabled}
	<AIChatDrawer />
{/if}

<Toast.Group {toaster}>
	{#snippet children(toast)}
		<Toast {toast} class={toastTypeStyles[toast.type ?? ''] ?? 'border-l-4 border-l-surface-400'}>
			<div class="flex w-full flex-col gap-1">
				<div class="flex items-center justify-between gap-2">
					<div class="flex min-w-0 items-center gap-2">
						<span
							class="shrink-0 text-sm font-bold {toastTypeIconColors[toast.type ?? ''] ??
								'text-surface-600'}">{toastTypeIcons[toast.type ?? ''] ?? '•'}</span
						>
						<Toast.Title class="text-sm font-semibold text-surface-900">{toast.title}</Toast.Title>
					</div>
					<Toast.CloseTrigger
						class="shrink-0 rounded p-1 text-surface-500 transition-colors hover:bg-black/10 hover:text-surface-900"
						aria-label="Dismiss"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="size-4"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
								clip-rule="evenodd"
							/>
						</svg>
					</Toast.CloseTrigger>
				</div>
				{#if toast.description}
					<Toast.Description class="pl-5 text-sm text-surface-700"
						>{toast.description}</Toast.Description
					>
				{/if}
			</div>
		</Toast>
	{/snippet}
</Toast.Group>
