<script lang="ts">
	import { page } from '$app/state';

	let { data, children } = $props();
	let currentPath = $derived(page.url.pathname);
	let effectivePermissions = $derived(
		(data as any).effectivePermissions ?? ({} as Record<string, boolean>)
	);
	const ADMIN_KEYS = [
		'user.read',
		'role.read',
		'audit.read',
		'label.read',
		'insurance.read',
		'system_preferences.read',
		'permission.read',
		'break_glass.admin'
	] as const;
	let isAdmin = $derived(ADMIN_KEYS.some((k) => effectivePermissions[k] === true));

	type NavItem = { href: string; label: string; description?: string };

	const manageItems: NavItem[] = [
		{ href: '/setting/manage/account', label: 'Account', description: 'Email and password' },
		{ href: '/setting/manage/patients', label: 'Patients', description: 'Patient roster' },
		{ href: '/setting/manage/insurances', label: 'Insurances', description: 'Payer list' },
		{
			href: '/setting/manage/preferences',
			label: 'Preferences',
			description: 'Personal options'
		}
	];

	const adminItems: NavItem[] = [
		{ href: '/setting/admin/users', label: 'Users', description: 'Manage workspace users' },
		{ href: '/setting/admin/roles', label: 'Roles', description: 'Roles and permissions' },
		{ href: '/setting/admin/labels', label: 'Labels', description: 'Denial labels' },
		{ href: '/setting/admin/preferences', label: 'System', description: 'AI, session, system' },
		{ href: '/setting/admin/audit', label: 'Audit Log', description: 'Activity history' }
	];

	function isActive(href: string): boolean {
		return currentPath === href || currentPath.startsWith(href + '/');
	}

	let activeItem = $derived(
		[...manageItems, ...adminItems].find((i) => isActive(i.href)) ?? manageItems[0]
	);
	let activeSection = $derived(adminItems.some((i) => isActive(i.href)) ? 'Admin' : 'Manage');
</script>

<div class="mx-auto w-full max-w-7xl">
	<!-- Page header -->
	<header class="mb-6 space-y-1">
		<!-- Breadcrumb: full path on md+, current page only on mobile -->
		<nav class="flex items-center gap-1.5 text-sm text-surface-500" aria-label="Breadcrumb">
			<a href="/dashboard" class="hover:text-primary-600 hover:underline">Home</a>
			<span aria-hidden="true">/</span>
			<span class="hidden font-medium text-surface-700 sm:inline">Settings</span>
			<span class="hidden sm:inline" aria-hidden="true">/</span>
			<span class="hidden text-surface-500 sm:inline">{activeSection}</span>
			<span class="hidden sm:inline" aria-hidden="true">/</span>
			<span class="font-medium text-surface-800">{activeItem.label}</span>
		</nav>
		<h1 class="text-2xl font-bold tracking-tight text-surface-900">Settings</h1>
		<p class="text-sm text-surface-500">
			Manage your account, workspace data, and (for admins) system configuration.
		</p>
	</header>

	<!-- Mobile nav: horizontal scroll pills (hidden on md+) -->
	<div class="mb-6 md:hidden">
		<div class="-mx-4 overflow-x-auto px-4 pb-2">
			<div class="flex min-w-max items-center gap-1">
				<span class="mr-1 shrink-0 text-xs font-semibold tracking-wide text-surface-500 uppercase">
					Manage
				</span>
				{#each manageItems as item (item.href)}
					<a
						href={item.href}
						aria-current={isActive(item.href) ? 'page' : undefined}
						class="btn shrink-0 btn-sm {isActive(item.href)
							? 'preset-filled-primary-500'
							: 'preset-tonal'}"
					>
						{item.label}
					</a>
				{/each}
				{#if isAdmin}
					<span class="mx-2 h-5 w-px shrink-0 bg-surface-300" aria-hidden="true"></span>
					<span
						class="mr-1 shrink-0 text-xs font-semibold tracking-wide text-surface-500 uppercase"
					>
						Admin
					</span>
					{#each adminItems as item (item.href)}
						<a
							href={item.href}
							aria-current={isActive(item.href) ? 'page' : undefined}
							class="btn shrink-0 btn-sm {isActive(item.href)
								? 'preset-filled-primary-500'
								: 'preset-tonal'}"
						>
							{item.label}
						</a>
					{/each}
				{/if}
			</div>
		</div>
	</div>

	<div class="grid gap-6 md:grid-cols-[240px_1fr]">
		<!-- Sidebar nav: hidden on mobile, shown on md+ -->
		<aside class="hidden space-y-6 md:block">
			<nav aria-label="Manage settings" class="space-y-2">
				<h2 class="px-2 text-xs font-semibold tracking-wide text-surface-500 uppercase">Manage</h2>
				<ul class="space-y-1">
					{#each manageItems as item (item.href)}
						<li>
							<a
								href={item.href}
								aria-current={isActive(item.href) ? 'page' : undefined}
								class="flex flex-col rounded-base px-3 py-2 text-sm transition-colors {isActive(
									item.href
								)
									? 'preset-tonal-primary font-semibold text-primary-700'
									: 'text-surface-700 hover:bg-surface-100'}"
							>
								<span>{item.label}</span>
								{#if item.description}
									<span class="text-xs font-normal text-surface-500">{item.description}</span>
								{/if}
							</a>
						</li>
					{/each}
				</ul>
			</nav>

			{#if isAdmin}
				<nav aria-label="Admin settings" class="space-y-2">
					<h2 class="px-2 text-xs font-semibold tracking-wide text-surface-500 uppercase">Admin</h2>
					<ul class="space-y-1">
						{#each adminItems as item (item.href)}
							<li>
								<a
									href={item.href}
									aria-current={isActive(item.href) ? 'page' : undefined}
									class="flex flex-col rounded-base px-3 py-2 text-sm transition-colors {isActive(
										item.href
									)
										? 'preset-tonal-primary font-semibold text-primary-700'
										: 'text-surface-700 hover:bg-surface-100'}"
								>
									<span>{item.label}</span>
									{#if item.description}
										<span class="text-xs font-normal text-surface-500">
											{item.description}
										</span>
									{/if}
								</a>
							</li>
						{/each}
					</ul>
				</nav>
			{/if}
		</aside>

		<!-- Main content -->
		<section class="min-w-0">
			{@render children()}
		</section>
	</div>
</div>
