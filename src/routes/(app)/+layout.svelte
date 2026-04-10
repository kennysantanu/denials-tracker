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

	const navItems = [
		{ href: '/dashboard', label: 'Dashboard', icon: '📊' },
		{ href: '/record', label: 'Record', icon: '📋' },
		{ href: '/file', label: 'Files', icon: '📁' },
		{ href: '/report', label: 'Report', icon: '📈' },
		{ href: '/setting', label: 'Settings', icon: '⚙️' }
	];

	let currentPath = $derived(page.url.pathname);

	function isActive(href: string): boolean {
		return currentPath === href || currentPath.startsWith(href + '/');
	}

	// AI chat button visibility: only on context-providing routes
	const aiContextRoutes = ['/dashboard', '/record/', '/report'];
	let showAiButton = $derived(
		data.aiEnabled && aiContextRoutes.some((r) => currentPath === r || currentPath.startsWith(r))
	);

	// Update chat context when route changes
	$effect(() => {
		setChatContext({ route: currentPath });
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

<div class="flex h-screen overflow-hidden bg-surface-50">
	<!-- Sidebar (desktop) -->
	<aside class="hidden w-64 flex-shrink-0 border-r border-surface-200 bg-white lg:block">
		<div class="flex h-full flex-col">
			<div class="flex h-16 items-center border-b border-surface-200 px-6">
				<h1 class="text-lg font-bold text-primary-600">Denials Tracker</h1>
			</div>
			<nav class="flex-1 space-y-1 px-3 py-4">
				{#each navItems as item (item.href)}
					<a
						href={item.href}
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
	</aside>

	<!-- Mobile drawer overlay -->
	{#if drawerOpen}
		<div class="fixed inset-0 z-40 lg:hidden">
			<!-- Backdrop -->
			<button
				class="fixed inset-0 bg-black/50"
				onclick={() => (drawerOpen = false)}
				aria-label="Close navigation"
			></button>
			<!-- Drawer -->
			<aside class="fixed top-0 left-0 z-50 flex h-full w-64 flex-col bg-white shadow-xl">
				<div class="flex h-16 items-center justify-between border-b border-surface-200 px-6">
					<h1 class="text-lg font-bold text-primary-600">Denials Tracker</h1>
					<button
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
			</aside>
		</div>
	{/if}

	<!-- Main content area -->
	<div class="flex flex-1 flex-col overflow-hidden">
		<!-- AppBar -->
		<header
			class="flex h-16 flex-shrink-0 items-center justify-between border-b border-surface-200 bg-white px-4 lg:px-8"
		>
			<div class="flex items-center gap-3">
				<!-- Mobile menu button -->
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
			</div>

			<!-- User menu -->
			<div class="flex items-center gap-4">
				{#if showAiButton}
					<button
						type="button"
						onclick={toggleChatDrawer}
						class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {isChatDrawerOpen()
							? 'bg-primary-100 text-primary-700'
							: 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'}"
						title="AI Assistant"
					>
						🤖 AI Chat
					</button>
				{/if}
				<span class="hidden text-sm text-surface-600 sm:inline">
					{data.user?.email ?? ''}
				</span>
				<form method="POST" action="/signout" use:enhance>
					<button
						type="submit"
						class="rounded-md px-3 py-1.5 text-sm font-medium text-surface-600 hover:bg-surface-100 hover:text-surface-900"
					>
						Sign Out
					</button>
				</form>
			</div>
		</header>

		<!-- Page content -->
		<main class="flex-1 overflow-y-auto p-4 lg:p-8">
			{@render children()}
		</main>
	</div>
</div>

<IdleTimeoutWarning />

{#if data.aiEnabled}
	<AIChatDrawer />
{/if}

<Toast.Group {toaster}>
	{#snippet children(toast)}
		<Toast {toast}>
			<Toast.Title>{toast.title}</Toast.Title>
			{#if toast.description}
				<Toast.Description>{toast.description}</Toast.Description>
			{/if}
			<Toast.CloseTrigger>✕</Toast.CloseTrigger>
		</Toast>
	{/snippet}
</Toast.Group>
