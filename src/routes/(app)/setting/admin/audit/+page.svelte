<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { untrack } from 'svelte';

	let { data } = $props();

	const initialFilters = untrack(() => data.filters);
	let userId = $state(initialFilters.userId ?? '');
	let action = $state(initialFilters.action ?? '');
	let resourceType = $state(initialFilters.resourceType ?? '');
	let startDate = $state(initialFilters.startDate ?? '');
	let endDate = $state(initialFilters.endDate ?? '');

	let totalPages = $derived(Math.max(1, Math.ceil(data.totalCount / data.pageSize)));
	let permissions = $derived((page.data as any).effectivePermissions ?? {});
	let canExport = $derived(permissions['audit.export'] === true || permissions['break_glass.admin'] === true);

	function applyFilters() {
		const params = new URLSearchParams();
		if (userId) params.set('userId', userId);
		if (action) params.set('action', action);
		if (resourceType) params.set('resourceType', resourceType);
		if (startDate) params.set('startDate', startDate);
		if (endDate) params.set('endDate', endDate);
		params.set('page', '1');
		goto(`/setting/admin/audit?${params.toString()}`);
	}

	function clearFilters() {
		userId = '';
		action = '';
		resourceType = '';
		startDate = '';
		endDate = '';
		goto('/setting/admin/audit');
	}

	function goToPage(p: number) {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('page', String(p));
		goto(`/setting/admin/audit?${params.toString()}`);
	}

	function exportCsv() {
		const params = new URLSearchParams();
		if (userId) params.set('userId', userId);
		if (action) params.set('action', action);
		if (resourceType) params.set('resourceType', resourceType);
		if (startDate) params.set('startDate', startDate);
		if (endDate) params.set('endDate', endDate);
		window.open(`/api/v1/audit/export?${params.toString()}`, '_blank', 'noopener');
	}
</script>

<svelte:head>
	<title>Audit Log | Denials Tracker</title>
</svelte:head>

<div class="space-y-6">
	<header class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 class="text-xl font-semibold text-surface-900">Audit log</h2>
			<p class="text-sm text-surface-500">
				HIPAA-compliant activity log of all user and system actions.
			</p>
		</div>
		{#if canExport}
			<button onclick={exportCsv} class="btn preset-filled-primary-500 btn-sm"> Export CSV </button>
		{/if}
	</header>

	<!-- Filters -->
	<div class="card bg-surface-50 p-4">
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
			<label class="label">
				<span class="label-text">User</span>
				<select id="filter-user" bind:value={userId} class="select">
					<option value="">All users</option>
					{#each data.users as u (u.id)}
						<option value={u.id}>{u.username || u.id}</option>
					{/each}
				</select>
			</label>
			<label class="label">
				<span class="label-text">Action</span>
				<input
					id="filter-action"
					type="text"
					bind:value={action}
					placeholder="e.g. view, create, login"
					class="input"
				/>
			</label>
			<label class="label">
				<span class="label-text">Resource type</span>
				<input
					id="filter-resource"
					type="text"
					bind:value={resourceType}
					placeholder="e.g. patient, denial"
					class="input"
				/>
			</label>
			<label class="label">
				<span class="label-text">Start date</span>
				<input id="filter-start" type="date" bind:value={startDate} class="input" />
			</label>
			<label class="label">
				<span class="label-text">End date</span>
				<input id="filter-end" type="date" bind:value={endDate} class="input" />
			</label>
		</div>
		<div class="mt-4 flex justify-end gap-2">
			<button onclick={clearFilters} class="btn preset-tonal btn-sm">Clear</button>
			<button onclick={applyFilters} class="btn preset-filled-primary-500 btn-sm">
				Apply filters
			</button>
		</div>
	</div>

	<!-- Results count -->
	<p class="text-sm text-surface-600">
		<strong>{data.totalCount}</strong> entries · Page {data.page} of {totalPages}
	</p>

	<!-- Table -->
	<div class="card border border-surface-200 bg-white p-0 shadow-sm">
		<div class="table-wrap">
			<table class="table caption-bottom">
				<thead>
					<tr>
						<th class="whitespace-nowrap">Timestamp</th>
						<th>User</th>
						<th>Action</th>
						<th>Resource</th>
						<th>Resource ID</th>
						<th>IP address</th>
						<th>Details</th>
					</tr>
				</thead>
				<tbody>
					{#each data.logs as log (log.id)}
						{@const userMatch = data.users.find((u: any) => u.id === log.user_id)}
						{@const badgeColor =
							log.action === 'login' || log.action === 'create'
								? 'success'
								: log.action === 'login_failed' || log.action === 'delete'
									? 'error'
									: log.action === 'logout' || log.action === 'export'
										? 'warning'
										: log.action === 'update'
											? 'primary'
											: 'surface'}
						<tr>
							<td class="whitespace-nowrap text-surface-700">
								{new Date(log.created_at).toLocaleString()}
							</td>
							<td class="text-surface-700">
								{userMatch?.username || log.user_id || '—'}
							</td>
							<td>
								<span class="badge preset-tonal-{badgeColor}">{log.action}</span>
							</td>
							<td class="text-surface-700">{log.resource_type}</td>
							<td class="font-mono text-xs text-surface-500">
								{log.resource_id || '—'}
							</td>
							<td class="font-mono text-xs text-surface-500">
								{log.ip_address || '—'}
							</td>
							<td
								class="max-w-xs truncate text-xs text-surface-500"
								title={log.details ? JSON.stringify(log.details) : ''}
							>
								{log.details ? JSON.stringify(log.details) : '—'}
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="7">
								<div
									class="rounded-container border-2 border-dashed border-surface-200 p-8 text-center"
								>
									<p class="text-sm text-surface-500">No audit log entries found.</p>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Pagination -->
	{#if totalPages > 1}
		<div class="flex flex-wrap items-center justify-center gap-2">
			<button
				onclick={() => goToPage(data.page - 1)}
				disabled={data.page <= 1}
				class="btn preset-tonal btn-sm"
			>
				Previous
			</button>
			{#each Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
				if (totalPages <= 7) return i + 1;
				if (data.page <= 4) return i + 1;
				if (data.page >= totalPages - 3) return totalPages - 6 + i;
				return data.page - 3 + i;
			}) as p (p)}
				<button
					onclick={() => goToPage(p)}
					class="btn btn-sm {p === data.page ? 'preset-filled-primary-500' : 'preset-tonal'}"
				>
					{p}
				</button>
			{/each}
			<button
				onclick={() => goToPage(data.page + 1)}
				disabled={data.page >= totalPages}
				class="btn preset-tonal btn-sm"
			>
				Next
			</button>
		</div>
	{/if}
</div>
