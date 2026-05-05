<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { formatDate } from '$lib/utils';
	import { hasPermission } from '$lib/types';

	let { data } = $props();

	let search = $state('');
	let debounceTimer: ReturnType<typeof setTimeout>;
	let lastSentSearch = '';

	$effect(() => {
		// Sync from server only on external navigation (back/forward).
		const serverSearch = data.search ?? '';
		if (serverSearch !== lastSentSearch) {
			search = serverSearch;
			lastSentSearch = serverSearch;
		}
	});

	function handleSearch() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(async () => {
			lastSentSearch = search;
			await goto(buildUrl({ search, page: 1 }), { keepFocus: true, noScroll: true });
		}, 500);
	}

	let totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));
	const permissions = $derived(page.data.permissions);
	const canManagePatients = $derived(
		hasPermission(permissions, 'manage_patients') || hasPermission(permissions, 'admin')
	);

	function buildUrl(overrides: Record<string, string | number> = {}) {
		const params = new URLSearchParams();
		const merged = {
			page: data.page,
			pageSize: data.pageSize,
			search: search,
			sortBy: data.sortBy,
			sortDir: data.sortDir,
			...overrides
		};
		if (merged.search) params.set('search', String(merged.search));
		if (merged.sortBy !== 'last_name' || merged.sortDir !== 'asc') {
			params.set('sortBy', String(merged.sortBy));
			params.set('sortDir', String(merged.sortDir));
		}
		if (merged.pageSize !== 10) params.set('pageSize', String(merged.pageSize));
		if (merged.page > 1) params.set('page', String(merged.page));
		const qs = params.toString();
		return `/record${qs ? `?${qs}` : ''}`;
	}

	async function goToPage(p: number) {
		if (p < 1 || p > totalPages) return;
		await goto(buildUrl({ page: p }));
	}

	async function handleSort(column: string) {
		const newDir = data.sortBy === column && data.sortDir === 'asc' ? 'desc' : 'asc';
		await goto(buildUrl({ sortBy: column, sortDir: newDir, page: 1 }));
	}

	async function clearSearch() {
		search = '';
		lastSentSearch = '';
		clearTimeout(debounceTimer);
		await goto(buildUrl({ search: '', page: 1 }));
	}

	async function handlePageSize(e: Event) {
		const size = parseInt((e.target as HTMLSelectElement).value, 10);
		await goto(buildUrl({ pageSize: size, page: 1 }));
	}

	function sortIcon(column: string): string {
		if (data.sortBy !== column) return '↕';
		return data.sortDir === 'asc' ? '↑' : '↓';
	}
</script>

<svelte:head>
	<title>Record | Denials Tracker</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-4 p-6">
	<div class="flex flex-wrap items-center justify-between gap-4">
		<h1 class="text-2xl font-bold">Patient Records</h1>
		{#if canManagePatients}
			<a
				href="/setting/manage/patients"
				class="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:outline-none"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 4v16m8-8H4"
					/>
				</svg>
				Add Patient
			</a>
		{/if}
	</div>

	<!-- Search & filters bar -->
	<div class="flex flex-wrap items-center gap-3">
		<div class="relative flex-1">
			<svg
				class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-surface-400"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
				/>
			</svg>
			<input
				type="text"
				bind:value={search}
				oninput={handleSearch}
				placeholder="Search by name or date of birth (MM/DD/YYYY)…"
				class="w-full rounded-lg border border-surface-300 bg-surface-50 py-2 pr-9 pl-10 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
			/>
			{#if search}
				<button
					type="button"
					onclick={clearSearch}
					class="absolute top-1/2 right-3 -translate-y-1/2 text-surface-400 hover:text-surface-700"
					aria-label="Clear search"
				>
					✕
				</button>
			{/if}
		</div>
		<div class="flex items-center gap-2 text-sm text-surface-600">
			<label for="pageSize">Rows:</label>
			<select
				id="pageSize"
				value={data.pageSize}
				onchange={handlePageSize}
				class="w-16 rounded-md border border-surface-300 bg-surface-50 px-2 py-1.5 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
			>
				<option value={10}>10</option>
				<option value={25}>25</option>
				<option value={50}>50</option>
				<option value={100}>100</option>
			</select>
		</div>
	</div>

	<!-- Results summary -->
	<p class="text-sm text-surface-600">
		{data.total} patient{data.total !== 1 ? 's' : ''} found{data.search
			? ` matching "${data.search}"`
			: ''}
		· Page {data.page} of {totalPages}
	</p>

	<!-- Table -->
	<div class="overflow-x-auto rounded-lg border border-surface-200">
		<table class="w-full table-fixed divide-y divide-surface-200 text-sm">
			<colgroup>
				<col class="w-[40%]" />
				<col class="w-[35%]" />
				<col class="w-[25%]" />
			</colgroup>
			<thead class="bg-surface-50">
				<tr>
					<th class="px-4 py-3 text-left font-medium whitespace-nowrap text-surface-600">
						<button
							onclick={() => handleSort('last_name')}
							class="inline-flex items-center gap-1 hover:text-surface-900"
						>
							Last Name <span class="text-xs">{sortIcon('last_name')}</span>
						</button>
					</th>
					<th class="px-4 py-3 text-left font-medium whitespace-nowrap text-surface-600">
						<button
							onclick={() => handleSort('first_name')}
							class="inline-flex items-center gap-1 hover:text-surface-900"
						>
							First Name <span class="text-xs">{sortIcon('first_name')}</span>
						</button>
					</th>
					<th class="px-4 py-3 text-left font-medium whitespace-nowrap text-surface-600">
						<button
							onclick={() => handleSort('date_of_birth')}
							class="inline-flex items-center gap-1 hover:text-surface-900"
						>
							Date of Birth <span class="text-xs">{sortIcon('date_of_birth')}</span>
						</button>
					</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-surface-100">
				{#each data.patients as patient (patient.id)}
					<tr
						class="cursor-pointer transition-colors hover:bg-surface-50"
						onclick={() => {
							void goto(`/record/${patient.id}`);
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								void goto(`/record/${patient.id}`);
							}
						}}
						tabindex="0"
						role="link"
					>
						<td class="truncate px-4 py-2.5 font-medium text-surface-900">{patient.last_name}</td>
						<td class="truncate px-4 py-2.5 text-surface-700">{patient.first_name}</td>
						<td class="px-4 py-2.5 text-surface-600">{formatDate(patient.date_of_birth)}</td>
					</tr>
				{:else}
					<tr>
						<td colspan="3" class="px-4 py-12 text-center text-surface-500">
							{#if data.search}
								<p class="text-lg">No patients match your search.</p>
								<p class="mt-1 text-sm">
									Try a different search term or <button
										onclick={clearSearch}
										class="text-primary-600 underline hover:text-primary-800"
										>clear the search</button
									>.
								</p>
							{:else}
								<p class="text-lg">No patients found.</p>
							{/if}
						</td>
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
