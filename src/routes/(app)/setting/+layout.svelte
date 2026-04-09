<script lang="ts">
	import { page } from '$app/state';

	let { data, children } = $props();
	let currentPath = $derived(page.url.pathname);
	let permissions = $derived((data as any).permissions ?? {});

	const manageTabs = [
		{ href: '/setting/manage/account', label: 'Account' },
		{ href: '/setting/manage/patients', label: 'Patients' },
		{ href: '/setting/manage/insurances', label: 'Insurances' },
		{ href: '/setting/manage/preferences', label: 'Preferences' }
	];

	const adminTabs = [
		{ href: '/setting/admin/users', label: 'Users' },
		{ href: '/setting/admin/roles', label: 'Roles' },
		{ href: '/setting/admin/labels', label: 'Labels' },
		{ href: '/setting/admin/preferences', label: 'Preferences' },
		{ href: '/setting/admin/audit', label: 'Audit Log' }
	];

	function isActive(href: string): boolean {
		return currentPath === href || currentPath.startsWith(href + '/');
	}
</script>

<div class="mx-auto max-w-6xl px-4 py-6">
	<h1 class="mb-6 text-2xl font-bold text-surface-900">Settings</h1>

	<div class="mb-6 space-y-4">
		<!-- Manage tabs -->
		<div>
			<h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500">Manage</h2>
			<nav class="flex flex-wrap gap-1 border-b border-surface-200 pb-2">
				{#each manageTabs as tab (tab.href)}
					<a
						href={tab.href}
						class="rounded-t-md px-4 py-2 text-sm font-medium transition-colors {isActive(tab.href)
							? 'border-b-2 border-primary-500 bg-primary-50 text-primary-700'
							: 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'}"
					>
						{tab.label}
					</a>
				{/each}
			</nav>
		</div>

		<!-- Admin tabs (only visible to admins) -->
		{#if permissions['admin']}
			<div>
				<h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500">Admin</h2>
				<nav class="flex flex-wrap gap-1 border-b border-surface-200 pb-2">
					{#each adminTabs as tab (tab.href)}
						<a
							href={tab.href}
							class="rounded-t-md px-4 py-2 text-sm font-medium transition-colors {isActive(tab.href)
								? 'border-b-2 border-primary-500 bg-primary-50 text-primary-700'
								: 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'}"
						>
							{tab.label}
						</a>
					{/each}
				</nav>
			</div>
		{/if}
	</div>

	<div class="rounded-lg border border-surface-200 bg-white p-6">
		{@render children()}
	</div>
</div>
