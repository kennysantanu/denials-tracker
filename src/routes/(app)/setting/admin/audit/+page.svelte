<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let { data } = $props();

	let userId = $state(data.filters.userId ?? '');
	let action = $state(data.filters.action ?? '');
	let resourceType = $state(data.filters.resourceType ?? '');
	let startDate = $state(data.filters.startDate ?? '');
	let endDate = $state(data.filters.endDate ?? '');

	let totalPages = $derived(Math.max(1, Math.ceil(data.totalCount / data.pageSize)));

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
		window.open(`/api/v1/audit/export?${params.toString()}`, '_blank');
	}

	// Unique values for filter dropdowns
	let uniqueActions = $derived([...new Set(data.logs.map((l: any) => l.action))].sort());
	let uniqueResourceTypes = $derived([...new Set(data.logs.map((l: any) => l.resource_type))].sort());
</script>

<svelte:head>
	<title>Audit Log — Denials Tracker</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h2 class="text-xl font-semibold text-surface-900">Audit Log</h2>
		<button
			onclick={exportCsv}
			class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
		>
			Export CSV
		</button>
	</div>

	<!-- Filters -->
	<div class="rounded-lg border border-surface-200 bg-surface-50 p-4">
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
			<div>
				<label for="filter-user" class="mb-1 block text-xs font-medium text-surface-600">User</label>
				<select
					id="filter-user"
					bind:value={userId}
					class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm"
				>
					<option value="">All Users</option>
					{#each data.users as u (u.id)}
						<option value={u.id}>{u.username || u.id}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="filter-action" class="mb-1 block text-xs font-medium text-surface-600">Action</label>
				<input
					id="filter-action"
					type="text"
					bind:value={action}
					placeholder="e.g. view, create, login"
					class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm"
				/>
			</div>
			<div>
				<label for="filter-resource" class="mb-1 block text-xs font-medium text-surface-600">Resource Type</label>
				<input
					id="filter-resource"
					type="text"
					bind:value={resourceType}
					placeholder="e.g. patient, denial"
					class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm"
				/>
			</div>
			<div>
				<label for="filter-start" class="mb-1 block text-xs font-medium text-surface-600">Start Date</label>
				<input
					id="filter-start"
					type="date"
					bind:value={startDate}
					class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm"
				/>
			</div>
			<div>
				<label for="filter-end" class="mb-1 block text-xs font-medium text-surface-600">End Date</label>
				<input
					id="filter-end"
					type="date"
					bind:value={endDate}
					class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm"
				/>
			</div>
		</div>
		<div class="mt-3 flex gap-2">
			<button
				onclick={applyFilters}
				class="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
			>
				Apply Filters
			</button>
			<button
				onclick={clearFilters}
				class="rounded-md border border-surface-300 px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-100"
			>
				Clear
			</button>
		</div>
	</div>

	<!-- Results count -->
	<p class="text-sm text-surface-600">
		{data.totalCount} entries found · Page {data.page} of {totalPages}
	</p>

	<!-- Table -->
	<div class="overflow-x-auto rounded-lg border border-surface-200">
		<table class="min-w-[900px] divide-y divide-surface-200 text-sm">
			<thead class="bg-surface-50">
				<tr>
					<th class="whitespace-nowrap px-4 py-3 text-left font-medium text-surface-600">Timestamp</th>
					<th class="whitespace-nowrap px-4 py-3 text-left font-medium text-surface-600">User</th>
					<th class="whitespace-nowrap px-4 py-3 text-left font-medium text-surface-600">Action</th>
					<th class="whitespace-nowrap px-4 py-3 text-left font-medium text-surface-600">Resource</th>
					<th class="whitespace-nowrap px-4 py-3 text-left font-medium text-surface-600">Resource ID</th>
					<th class="whitespace-nowrap px-4 py-3 text-left font-medium text-surface-600">IP Address</th>
					<th class="whitespace-nowrap px-4 py-3 text-left font-medium text-surface-600">Details</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-surface-100">
				{#each data.logs as log (log.id)}
					{@const userMatch = data.users.find((u: any) => u.id === log.user_id)}
					<tr class="hover:bg-surface-50">
						<td class="whitespace-nowrap px-4 py-2 text-surface-700">
							{new Date(log.created_at).toLocaleString()}
						</td>
						<td class="px-4 py-2 text-surface-700">
							{userMatch?.username || log.user_id || '—'}
						</td>
						<td class="px-4 py-2">
							<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium
								{log.action === 'login' ? 'bg-green-100 text-green-800' :
								 log.action === 'login_failed' ? 'bg-red-100 text-red-800' :
								 log.action === 'logout' ? 'bg-yellow-100 text-yellow-800' :
								 log.action === 'delete' ? 'bg-red-100 text-red-800' :
								 log.action === 'create' ? 'bg-blue-100 text-blue-800' :
								 log.action === 'update' ? 'bg-purple-100 text-purple-800' :
								 log.action === 'export' ? 'bg-orange-100 text-orange-800' :
								 'bg-surface-100 text-surface-800'}">
								{log.action}
							</span>
						</td>
						<td class="px-4 py-2 text-surface-700">{log.resource_type}</td>
						<td class="px-4 py-2 text-surface-500">{log.resource_id || '—'}</td>
						<td class="px-4 py-2 text-surface-500">{log.ip_address || '—'}</td>
						<td class="max-w-xs truncate px-4 py-2 text-xs text-surface-500" title={log.details ? JSON.stringify(log.details) : ''}>
							{log.details ? JSON.stringify(log.details) : '—'}
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="7" class="px-4 py-8 text-center text-surface-500">No audit log entries found.</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Pagination -->
	{#if totalPages > 1}
		<div class="flex items-center justify-center gap-2">
			<button
				onclick={() => goToPage(data.page - 1)}
				disabled={data.page <= 1}
				class="rounded-md border border-surface-300 px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-100 disabled:opacity-50"
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
					class="rounded-md px-3 py-1.5 text-sm font-medium {p === data.page
						? 'bg-primary-600 text-white'
						: 'border border-surface-300 text-surface-700 hover:bg-surface-100'}"
				>
					{p}
				</button>
			{/each}
			<button
				onclick={() => goToPage(data.page + 1)}
				disabled={data.page >= totalPages}
				class="rounded-md border border-surface-300 px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-100 disabled:opacity-50"
			>
				Next
			</button>
		</div>
	{/if}
</div>
