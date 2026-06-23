<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import IdleTimeoutWarning from '$lib/components/IdleTimeoutWarning.svelte';
	import AIChatDrawer from '$lib/components/ai/AIChatDrawer.svelte';
	import { Tabs, Toast } from '@skeletonlabs/skeleton-svelte';
	import { toaster } from '$lib/toast';
	import Menu from '@lucide/svelte/icons/menu';
	import LogOut from '@lucide/svelte/icons/log-out';
	import X from '@lucide/svelte/icons/x';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Info from '@lucide/svelte/icons/info';
	import {
		isChatDrawerOpen,
		toggleChatDrawer,
		updateChatContext
	} from '$lib/stores/chatContext.svelte';

	let { data, children } = $props();

	let drawerOpen = $state(false);
	let closeButtonRef = $state<HTMLButtonElement>();
	let userMenuOpen = $state(false);

	const navItems = [
		{ href: '/record', label: 'Record' },
		{ href: '/report', label: 'Report' },
		{ href: '/file', label: 'Files' },
		{ href: '/setting', label: 'Settings' }
	];

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

	let tabValue = $derived(navItems.find((item) => isActive(item.href))?.href ?? null);

	// AI chat button: visible on all (app) pages when AI is enabled and user has ai.chat permission
	let showAiButton = $derived(data.aiEnabled && data.effectivePermissions['ai.chat'] === true);

	// Clear page-specific context on route change before page effects set it.
	// $effect.pre runs in the pre-DOM phase, so it always precedes the page's
	// $effect (post-DOM) — the page's context wins the final state.
	$effect.pre(() => {
		updateChatContext({
			route: currentPath,
			patientId: undefined,
			pageData: undefined
		});
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
		} = data.supabase.auth.onAuthStateChange((event: string, _session: unknown) => {
			// TOKEN_REFRESHED is handled server-side via cookies; invalidating here would
			// trigger 3+ unnecessary DB round-trips on every silent token refresh, causing
			// the UI to freeze briefly during navigation.
			if (event !== 'TOKEN_REFRESHED') {
				invalidate('supabase:auth');
			}
		});

		return () => subscription.unsubscribe();
	});
</script>

<div class="flex h-screen flex-col overflow-hidden bg-surface-50">
	<!-- Top navbar -->
	<header class="shrink-0 border-b border-surface-200 bg-white">
		<div class="relative flex h-16 items-center justify-between px-4 lg:px-8">
			<!-- Left: Hamburger (mobile) + Logo -->
			<div class="flex items-center gap-3">
				<button
					class="btn p-2 hover:preset-tonal lg:hidden"
					onclick={() => (drawerOpen = true)}
					aria-label="Open navigation"
				>
					<Menu class="h-6 w-6" />
				</button>
				<h1 class="text-2xl font-bold text-primary-500">Denials Tracker</h1>
			</div>

			<!-- Center: Desktop nav -->
			<nav class="absolute top-4 left-1/2 hidden -translate-x-1/2 lg:block">
				<Tabs value={tabValue} navigate={() => {}}>
					<Tabs.List class="justify-center gap-16">
						{#each navItems as item (item.href)}
							<Tabs.Trigger value={item.href} class="text-sm">
								{#snippet element(attrs)}
									<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
									<a href={item.href} {...attrs as any}>{item.label}</a>
								{/snippet}
							</Tabs.Trigger>
						{/each}
						<Tabs.Indicator class="bg-primary-500" />
					</Tabs.List>
				</Tabs>
			</nav>

			<!-- Right: User actions -->
			<div class="flex items-center gap-2">
				{#if showAiButton}
					<!-- Desktop-only AI Chat button -->
					<button
						type="button"
						onclick={toggleChatDrawer}
						class="btn hidden btn-sm lg:block {isChatDrawerOpen()
							? 'preset-tonal-primary'
							: 'hover:preset-tonal'}"
						title="AI Assistant"
					>
						<span class="text-sm font-medium">AI Chat</span>
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
						<button type="submit" class="btn btn-sm hover:preset-tonal"> Sign Out </button>
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
							class="absolute right-0 z-20 mt-2 w-52 rounded-container border border-surface-200 bg-white py-1 shadow-lg"
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
									AI Chat
								</button>
							{/if}
							<form method="POST" action="/signout" use:enhance>
								<button
									type="submit"
									class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-surface-700 hover:bg-surface-50"
									role="menuitem"
								>
									<LogOut class="h-4 w-4 shrink-0" aria-hidden="true" />
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
		<div class="fixed inset-0 z-30 lg:hidden">
			<!-- Backdrop -->
			<div
				role="presentation"
				class="fixed inset-0 bg-black/50"
				onclick={() => (drawerOpen = false)}
			></div>
			<!-- Drawer -->
			<div
				class="fixed top-0 left-0 z-40 flex h-full w-64 flex-col bg-white shadow-xl"
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
						class="btn p-1 hover:preset-tonal"
						aria-label="Close menu"
					>
						<X class="h-5 w-5" />
					</button>
				</div>
				<nav class="flex-1 space-y-1 px-3 py-4">
					{#each navItems as item (item.href)}
						<a
							href={item.href}
							onclick={() => (drawerOpen = false)}
							aria-current={isActive(item.href) ? 'page' : undefined}
							class="btn w-full justify-start {isActive(item.href)
								? 'preset-tonal-primary'
								: 'hover:preset-tonal'}"
						>
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
						class="shrink-0 {toastTypeIconColors[toast.type ?? ''] ?? 'text-surface-600'}"
					>
						{#if toast.type === 'success'}
							<CircleCheck class="h-4 w-4" />
						{:else if toast.type === 'error'}
							<CircleX class="h-4 w-4" />
						{:else if toast.type === 'warning'}
							<TriangleAlert class="h-4 w-4" />
						{:else}
							<Info class="h-4 w-4" />
						{/if}
					</span>
					<Toast.Title class="text-sm font-semibold text-surface-900">{toast.title}</Toast.Title>
				</div>
				<Toast.CloseTrigger
					class="shrink-0 rounded p-1 text-surface-500 transition-colors hover:bg-black/10 hover:text-surface-900"
					aria-label="Dismiss"
				>
					<X class="size-4" />
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
