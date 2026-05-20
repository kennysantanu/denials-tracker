<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { formatDate } from '$lib/utils';
	import { toastError } from '$lib/toast';
	import { Pagination } from '@skeletonlabs/skeleton-svelte';

	let { data } = $props();

	let search = $state('');
	let debounceTimer: ReturnType<typeof setTimeout>;
	let lastSentSearch = '';
	let showAddForm = $state(false);

	let addFirst = $state('');
	let addLast = $state('');
	let addDob = $state('');
	let duplicates = $state<
		{ id: number; first_name: string; last_name: string; date_of_birth: string | null }[]
	>([]);
	let dupTimer: ReturnType<typeof setTimeout>;

	function closeAddForm() {
		showAddForm = false;
		addFirst = '';
		addLast = '';
		addDob = '';
		duplicates = [];
	}

	function searchDuplicates() {
		clearTimeout(dupTimer);
		duplicates = [];
		const params = new URLSearchParams();
		if (addDob) params.set('dob', addDob);
		if (addLast.trim()) params.set('last_name', addLast.trim());
		if (addFirst.trim()) params.set('first_name', addFirst.trim());
		if (!params.toString()) return;
		dupTimer = setTimeout(async () => {
			const res = await fetch(`/api/v1/patients?${params}`);
			if (res.ok) {
				const body = await res.json();
				duplicates = body.patients ?? [];
			}
		}, 300);
	}

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
	const effectivePermissions = $derived(
		(page.data as any).effectivePermissions ?? ({} as Record<string, boolean>)
	);
	const canManagePatients = $derived(effectivePermissions['patient.create'] === true);

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

<div class="mx-auto max-w-5xl space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-4">
		<h1 class="text-2xl font-bold">Patient Records</h1>
		{#if canManagePatients}
			<button
				type="button"
				onclick={() => (showAddForm ? closeAddForm() : (showAddForm = true))}
				class="btn {showAddForm ? 'preset-tonal' : 'preset-filled-primary-500'}"
			>
				{showAddForm ? 'Cancel' : '+ Add patient'}
			</button>
		{/if}
	</div>

	{#if showAddForm}
		<form
			method="POST"
			action="?/createPatient"
			use:enhance={() =>
				async ({ result, update }) => {
					if (result.type === 'failure') {
						toastError((result.data as any)?.error ?? 'Failed to create patient');
					}
					await update();
				}}
			class="card bg-surface-50 p-4"
		>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<label class="label">
					<span class="label-text">Date of birth</span>
					<input
						name="date_of_birth"
						type="date"
						required
						class="input"
						bind:value={addDob}
						oninput={searchDuplicates}
					/>
				</label>
				<label class="label">
					<span class="label-text">Last name</span>
					<input
						name="last_name"
						type="text"
						required
						class="input"
						bind:value={addLast}
						oninput={searchDuplicates}
					/>
				</label>
				<label class="label">
					<span class="label-text">First name</span>
					<input
						name="first_name"
						type="text"
						required
						class="input"
						bind:value={addFirst}
						oninput={searchDuplicates}
					/>
				</label>
				<label class="label">
					<span class="label-text">Note</span>
					<input name="note" type="text" class="input" />
				</label>
			</div>

			{#if duplicates.length > 0}
				<div class="mt-4 rounded-base border border-warning-300 bg-warning-50 p-3">
					<p class="mb-2 text-xs font-semibold tracking-wide text-warning-700 uppercase">
						Possible existing patients
					</p>
					<div class="table-wrap">
						<table class="table table-fixed caption-bottom">
							<colgroup>
								<col class="w-[40%]" />
								<col class="w-[35%]" />
								<col class="w-[25%]" />
							</colgroup>
							<thead>
								<tr>
									<th class="px-4 py-3 text-left font-medium whitespace-nowrap text-surface-600"
										>Last Name</th
									>
									<th class="px-4 py-3 text-left font-medium whitespace-nowrap text-surface-600"
										>First Name</th
									>
									<th class="px-4 py-3 text-left font-medium whitespace-nowrap text-surface-600"
										>Date of Birth</th
									>
								</tr>
							</thead>
							<tbody class="[&>tr]:hover:preset-tonal-warning">
								{#each duplicates as dup (dup.id)}
									<tr
										class="cursor-pointer transition-colors"
										onclick={() => {
											void goto(`/record/${dup.id}`);
										}}
										onkeydown={(e) => {
											if (e.key === 'Enter') void goto(`/record/${dup.id}`);
										}}
										tabindex="0"
										role="link"
									>
										<td class="truncate px-4 py-2.5 font-medium text-surface-900"
											>{dup.last_name}</td
										>
										<td class="truncate px-4 py-2.5 text-surface-700">{dup.first_name}</td>
										<td class="px-4 py-2.5 text-surface-600">{formatDate(dup.date_of_birth)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			<div class="mt-4 flex justify-end gap-2">
				<button type="button" class="btn preset-tonal" onclick={closeAddForm}> Cancel </button>
				<button type="submit" class="btn preset-filled-success-500">Create patient</button>
			</div>
		</form>
	{/if}

	<!-- Search & filters bar -->
	{#if !showAddForm}
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
					class="input pr-9 pl-10"
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
				<select id="pageSize" value={data.pageSize} onchange={handlePageSize} class="select w-auto">
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
		<div class="table-wrap">
			<table class="table table-fixed caption-bottom">
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
				<tbody class="[&>tr]:hover:preset-tonal-primary">
					{#each data.patients as patient (patient.id)}
						<tr
							class="cursor-pointer transition-colors"
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
			<div class="flex justify-center">
				<Pagination
					page={data.page}
					count={data.total}
					pageSize={data.pageSize}
					onPageChange={(d) => goToPage(d.page)}
				>
					<Pagination.Context>
						{#snippet children(api)}
							<Pagination.PrevTrigger>
								{#snippet element(attrs)}
									<button {...attrs} class="btn preset-tonal">Previous</button>
								{/snippet}
							</Pagination.PrevTrigger>
							{#each api().pages as p, i (p.type === 'page' ? p.value : `e${i}`)}
								{#if p.type === 'page'}
									<Pagination.Item type="page" value={p.value}>
										{#snippet element(attrs)}
											<!-- eslint-disable-next-line svelte/no-useless-mustaches -->
											<button
												{...attrs as any}
												type="button"
												class="btn {p.value === api().page
													? 'preset-filled-primary-500'
													: 'preset-tonal'}">{p.value}</button
											>
										{/snippet}
									</Pagination.Item>
								{:else}
									<Pagination.Ellipsis index={i}>
										{#snippet element(attrs)}
											<span {...attrs} class="btn cursor-default preset-tonal">…</span>
										{/snippet}
									</Pagination.Ellipsis>
								{/if}
							{/each}
							<Pagination.NextTrigger>
								{#snippet element(attrs)}
									<button {...attrs} class="btn preset-tonal">Next</button>
								{/snippet}
							</Pagination.NextTrigger>
						{/snippet}
					</Pagination.Context>
				</Pagination>
			</div>
		{/if}
	{/if}
</div>
