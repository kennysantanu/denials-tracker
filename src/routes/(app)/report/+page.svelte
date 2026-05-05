<script lang="ts">
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { Combobox } from '@skeletonlabs/skeleton-svelte';
	import { ListCollection } from '@zag-js/collection';
	import { formatDate } from '$lib/utils';
	import { setChatContext } from '$lib/stores/chatContext.svelte';
	import type { ReportRow } from '$lib/server/db/reports';

	let { data } = $props();

	type SortKey =
		| 'patient'
		| 'service_date'
		| 'billed'
		| 'insurances'
		| 'labels'
		| 'last_note'
		| 'status';

	const VALID_SORT_KEYS: SortKey[] = [
		'patient',
		'service_date',
		'billed',
		'insurances',
		'labels',
		'last_note',
		'status'
	];

	// Capture initial values for $state seeds (data is reactive on navigation,
	// but the form-control values should not auto-reset until user reloads).
	const seed = untrack(() => {
		const sp = new URL(page.url).searchParams;
		const sk = sp.get('sortKey');
		return {
			startDate: data.startDate,
			endDate: data.endDate,
			includeClosed: data.includeClosed,
			dateMode: data.dateMode,
			sortKey: sk && VALID_SORT_KEYS.includes(sk as SortKey) ? (sk as SortKey) : null,
			sortDir: (sp.get('sortDir') === 'asc'
				? 'asc'
				: sp.get('sortDir') === 'desc'
					? 'desc'
					: null) as 'asc' | 'desc' | null,
			patientFilter: sp.get('pf') ?? '',
			noteFilter: sp.get('nf') ?? '',
			insuranceFilter:
				sp
					.get('ins')
					?.split(',')
					.map(Number)
					.filter((n) => !isNaN(n) && n > 0) ?? [],
			labelFilter:
				sp
					.get('lbl')
					?.split(',')
					.map(Number)
					.filter((n) => !isNaN(n) && n > 0) ?? [],
			showFilters: sp.get('sf') === '1'
		};
	});
	let startDate = $state(seed.startDate);
	let endDate = $state(seed.endDate);
	let includeClosed = $state(seed.includeClosed);
	let dateMode = $state<'service' | 'lastNote'>(seed.dateMode);

	function generateReport() {
		const params = new URLSearchParams({
			startDate,
			endDate,
			includeClosed: String(includeClosed),
			dateMode
		});
		goto(`/report?${params.toString()}`);
	}

	function formatCurrency(value: number | null | undefined): string {
		if (value == null) return '$0.00';
		return (
			'$' +
			value.toLocaleString('en-US', {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			})
		);
	}

	function formatNoteTimestamp(iso: string): string {
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '';
		return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
	}

	let sortKey = $state<SortKey>(
		seed.sortKey ?? (seed.dateMode === 'lastNote' ? 'last_note' : 'service_date')
	);
	let sortDir = $state<'asc' | 'desc'>(seed.sortDir ?? 'desc');

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDir = 'asc';
		}
	}

	function sortIndicator(key: SortKey): string {
		if (sortKey !== key) return '';
		return sortDir === 'asc' ? '▲' : '▼';
	}

	let patientFilter = $state(seed.patientFilter);
	let noteFilter = $state(seed.noteFilter);
	let insuranceFilter = $state<number[]>(seed.insuranceFilter);
	let labelFilter = $state<number[]>(seed.labelFilter);
	let showFilters = $state(seed.showFilters);

	function clearFilters() {
		patientFilter = '';
		noteFilter = '';
		insuranceFilter = [];
		labelFilter = [];
	}

	const availableInsurances = $derived.by(() => {
		const map = new Map<number, string>();
		for (const r of data.reportData as ReportRow[]) {
			for (const ins of r.insurances) map.set(ins.id, ins.name);
		}
		return Array.from(map.entries())
			.map(([id, name]) => ({ id, name }))
			.sort((a, b) => a.name.localeCompare(b.name));
	});

	const availableLabels = $derived.by(() => {
		const map = new Map<number, { name: string; bg: string; txt: string }>();
		for (const r of data.reportData as ReportRow[]) {
			for (const lbl of r.labels) {
				map.set(lbl.id, { name: lbl.label_name, bg: lbl.bg_color, txt: lbl.txt_color });
			}
		}
		return Array.from(map.entries())
			.map(([id, v]) => ({ id, ...v }))
			.sort((a, b) => a.name.localeCompare(b.name));
	});

	// Combobox search state
	let insSearchInput = $state('');
	let lblSearchInput = $state('');

	let filteredInsItems = $derived(
		insSearchInput
			? availableInsurances.filter((ins) =>
					ins.name.toLowerCase().includes(insSearchInput.toLowerCase())
				)
			: availableInsurances
	);
	let filteredLblItems = $derived(
		lblSearchInput
			? availableLabels.filter((lbl) =>
					lbl.name.toLowerCase().includes(lblSearchInput.toLowerCase())
				)
			: availableLabels
	);

	let insCollection = $derived(
		new ListCollection({
			items: filteredInsItems,
			itemToValue: (item) => String(item.id),
			itemToString: (item) => item.name
		})
	);
	let lblCollection = $derived(
		new ListCollection({
			items: filteredLblItems,
			itemToValue: (item) => String(item.id),
			itemToString: (item) => item.name
		})
	);

	let insSelectedValues = $derived(insuranceFilter.map(String));
	let lblSelectedValues = $derived(labelFilter.map(String));

	function patientDisplay(r: ReportRow): string {
		if (!r.patient) return '';
		return `${r.patient.last_name}, ${r.patient.first_name}`;
	}

	function insurancesText(r: ReportRow): string {
		return r.insurances
			.map((i) => i.name)
			.sort((a, b) => a.localeCompare(b))
			.join(', ');
	}

	function labelsText(r: ReportRow): string {
		return r.labels
			.map((l) => l.label_name)
			.sort((a, b) => a.localeCompare(b))
			.join(', ');
	}

	const filteredRows = $derived.by(() => {
		const rows = data.reportData as ReportRow[];
		const pf = patientFilter.trim().toLowerCase();
		const nf = noteFilter.trim().toLowerCase();
		return rows.filter((r) => {
			if (pf && !patientDisplay(r).toLowerCase().includes(pf)) return false;
			if (nf) {
				const text = (r.last_note?.note ?? '').toLowerCase();
				const user = (r.last_note?.username ?? '').toLowerCase();
				if (!text.includes(nf) && !user.includes(nf)) return false;
			}
			if (insuranceFilter.length > 0) {
				const ids = new Set(r.insurances.map((i) => i.id));
				if (!insuranceFilter.some((id) => ids.has(id))) return false;
			}
			if (labelFilter.length > 0) {
				const ids = new Set(r.labels.map((l) => l.id));
				if (!labelFilter.some((id) => ids.has(id))) return false;
			}
			return true;
		});
	});

	const sortedRows = $derived.by(() => {
		const rows = [...filteredRows];
		const dir = sortDir === 'asc' ? 1 : -1;
		rows.sort((a, b) => {
			switch (sortKey) {
				case 'patient':
					return patientDisplay(a).localeCompare(patientDisplay(b)) * dir;
				case 'service_date':
					return (a.service_start_date ?? '').localeCompare(b.service_start_date ?? '') * dir;
				case 'billed':
					return ((a.billed_amount ?? 0) - (b.billed_amount ?? 0)) * dir;
				case 'insurances':
					return insurancesText(a).localeCompare(insurancesText(b)) * dir;
				case 'labels':
					return labelsText(a).localeCompare(labelsText(b)) * dir;
				case 'last_note': {
					const ad = a.last_note?.created_at ?? '';
					const bd = b.last_note?.created_at ?? '';
					return ad.localeCompare(bd) * dir;
				}
				case 'status':
					return (Number(a.is_closed) - Number(b.is_closed)) * dir;
				default:
					return 0;
			}
		});
		return rows;
	});

	const showStatusColumn = $derived(includeClosed);
	const colSpan = $derived(showStatusColumn ? 7 : 6);

	// Sync client-side filter/sort state into URL for shareability & refresh persistence.
	$effect(() => {
		const url = new URL(page.url);
		const sp = url.searchParams;

		// Sort
		sp.set('sortKey', sortKey);
		sp.set('sortDir', sortDir);

		// Filters
		if (patientFilter.trim()) sp.set('pf', patientFilter.trim());
		else sp.delete('pf');
		if (noteFilter.trim()) sp.set('nf', noteFilter.trim());
		else sp.delete('nf');
		if (insuranceFilter.length) sp.set('ins', insuranceFilter.join(','));
		else sp.delete('ins');
		if (labelFilter.length) sp.set('lbl', labelFilter.join(','));
		else sp.delete('lbl');
		if (showFilters) sp.set('sf', '1');
		else sp.delete('sf');

		replaceState(url, {});
	});

	$effect(() => {
		setChatContext({
			route: '/report',
			pageData: {
				startDate,
				endDate,
				includeClosed,
				dateMode,
				recordCount: data.reportData.length,
				filteredCount: sortedRows.length
			}
		});
	});
</script>

<svelte:head>
	<title>Report | Denials Tracker</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-2xl font-bold text-surface-900">Report</h1>

	<div
		class="no-print flex flex-wrap items-end gap-4 rounded-lg border border-surface-300 bg-surface-50 p-4"
	>
		<div class="flex flex-col gap-1">
			<span class="text-sm font-medium text-surface-700">Date Mode</span>
			<div class="flex items-center gap-3 text-sm text-surface-700">
				<label class="flex items-center gap-1">
					<input type="radio" bind:group={dateMode} value="service" />
					Service Date
				</label>
				<label class="flex items-center gap-1">
					<input type="radio" bind:group={dateMode} value="lastNote" />
					Last Note Date
				</label>
			</div>
		</div>

		<div class="flex flex-col gap-1">
			<label for="startDate" class="text-sm font-medium text-surface-700">Start Date</label>
			<input
				id="startDate"
				type="date"
				bind:value={startDate}
				class="rounded border border-surface-300 px-3 py-2 text-sm"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="endDate" class="text-sm font-medium text-surface-700">End Date</label>
			<input
				id="endDate"
				type="date"
				bind:value={endDate}
				class="rounded border border-surface-300 px-3 py-2 text-sm"
			/>
		</div>
		<label class="flex items-center gap-2 text-sm text-surface-700">
			<input type="checkbox" bind:checked={includeClosed} class="rounded" />
			Include Closed Claims
		</label>

		<button
			onclick={generateReport}
			class="rounded bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
		>
			Generate Report
		</button>
		<button
			onclick={() => (showFilters = !showFilters)}
			class="rounded border border-surface-300 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-100"
		>
			{showFilters ? 'Hide Filters' : 'Show Filters'}
		</button>
		<button
			onclick={clearFilters}
			class="rounded border border-surface-300 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-100"
		>
			Clear Filters
		</button>
		<button
			onclick={() => window.print()}
			class="rounded border border-surface-300 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-100"
		>
			Print
		</button>

		<div class="ml-auto text-sm text-surface-600">
			Showing {sortedRows.length} of {data.reportData.length} records
		</div>
	</div>

	<div class="overflow-x-auto">
		<table class="w-full text-left text-sm">
			<thead>
				<tr class="border-b border-surface-300 text-surface-600">
					<th class="px-3 py-2">
						<button class="sort-btn" onclick={() => toggleSort('patient')}>
							Patient Name <span class="text-xs">{sortIndicator('patient')}</span>
						</button>
					</th>
					<th class="px-3 py-2">
						<button class="sort-btn" onclick={() => toggleSort('service_date')}>
							Service Date <span class="text-xs">{sortIndicator('service_date')}</span>
						</button>
					</th>
					<th class="px-3 py-2 text-right">
						<button class="sort-btn" onclick={() => toggleSort('billed')}>
							Billed Amount <span class="text-xs">{sortIndicator('billed')}</span>
						</button>
					</th>
					<th class="px-3 py-2">
						<button class="sort-btn" onclick={() => toggleSort('insurances')}>
							Insurances <span class="text-xs">{sortIndicator('insurances')}</span>
						</button>
					</th>
					<th class="px-3 py-2">
						<button class="sort-btn" onclick={() => toggleSort('labels')}>
							Labels <span class="text-xs">{sortIndicator('labels')}</span>
						</button>
					</th>
					<th class="px-3 py-2">
						<button class="sort-btn" onclick={() => toggleSort('last_note')}>
							Last Note <span class="text-xs">{sortIndicator('last_note')}</span>
						</button>
					</th>
					{#if showStatusColumn}
						<th class="px-3 py-2">
							<button class="sort-btn" onclick={() => toggleSort('status')}>
								Status <span class="text-xs">{sortIndicator('status')}</span>
							</button>
						</th>
					{/if}
				</tr>

				{#if showFilters}
					<tr class="no-print border-b border-surface-200 bg-surface-50 align-top">
						<th class="px-3 py-2">
							<input
								type="text"
								bind:value={patientFilter}
								placeholder="Filter name…"
								class="w-full rounded border border-surface-300 px-2 py-1 text-xs font-normal"
							/>
						</th>
						<th class="px-3 py-2"></th>
						<th class="px-3 py-2"></th>
						<th class="px-3 py-2">
							<Combobox
								collection={insCollection}
								multiple={true}
								value={insSelectedValues}
								onValueChange={(details) => {
									insuranceFilter = details.value.map(Number);
								}}
								inputValue={insSearchInput}
								onInputValueChange={(details) => {
									insSearchInput = details.inputValue;
								}}
								openOnClick={true}
								selectionBehavior="clear"
								placeholder="Insurances ({insuranceFilter.length})…"
								closeOnSelect={false}
							>
								<Combobox.Control class="relative">
									<Combobox.Input
										class="w-full rounded border border-surface-300 bg-white px-2 py-1 text-xs font-normal placeholder:text-surface-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
									/>
									<Combobox.Trigger
										class="absolute top-1/2 right-1 -translate-y-1/2 text-surface-400 hover:text-surface-600"
									>
										<svg
											class="h-3 w-3"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="2"
										>
											<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
										</svg>
									</Combobox.Trigger>
								</Combobox.Control>
								<Combobox.Positioner>
									<Combobox.Content
										class="z-50 max-h-48 overflow-auto rounded-lg border border-surface-200 bg-white shadow-lg"
									>
										{#each filteredInsItems as ins (ins.id)}
											<Combobox.Item
												item={ins}
												class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-100 data-highlighted:bg-surface-100"
											>
												<Combobox.ItemIndicator>
													<svg
														class="h-3 w-3 text-primary-600"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
														stroke-width="2"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															d="M5 13l4 4L19 7"
														/>
													</svg>
												</Combobox.ItemIndicator>
												<Combobox.ItemText>{ins.name}</Combobox.ItemText>
											</Combobox.Item>
										{/each}
										{#if filteredInsItems.length === 0}
											<div class="px-3 py-2 text-xs text-surface-400">No insurances found</div>
										{/if}
									</Combobox.Content>
								</Combobox.Positioner>
							</Combobox>
						</th>
						<th class="px-3 py-2">
							<Combobox
								collection={lblCollection}
								multiple={true}
								value={lblSelectedValues}
								onValueChange={(details) => {
									labelFilter = details.value.map(Number);
								}}
								inputValue={lblSearchInput}
								onInputValueChange={(details) => {
									lblSearchInput = details.inputValue;
								}}
								openOnClick={true}
								selectionBehavior="clear"
								placeholder="Labels ({labelFilter.length})…"
								closeOnSelect={false}
							>
								<Combobox.Control class="relative">
									<Combobox.Input
										class="w-full rounded border border-surface-300 bg-white px-2 py-1 text-xs font-normal placeholder:text-surface-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
									/>
									<Combobox.Trigger
										class="absolute top-1/2 right-1 -translate-y-1/2 text-surface-400 hover:text-surface-600"
									>
										<svg
											class="h-3 w-3"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="2"
										>
											<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
										</svg>
									</Combobox.Trigger>
								</Combobox.Control>
								<Combobox.Positioner>
									<Combobox.Content
										class="z-50 max-h-48 overflow-auto rounded-lg border border-surface-200 bg-white shadow-lg"
									>
										{#each filteredLblItems as lbl (lbl.id)}
											<Combobox.Item
												item={lbl}
												class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-100 data-highlighted:bg-surface-100"
											>
												<Combobox.ItemIndicator>
													<svg
														class="h-3 w-3 text-primary-600"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
														stroke-width="2"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															d="M5 13l4 4L19 7"
														/>
													</svg>
												</Combobox.ItemIndicator>
												<Combobox.ItemText>
													<span
														class="rounded px-2 py-0.5 text-xs"
														style="background-color: {lbl.bg}; color: {lbl.txt};"
													>
														{lbl.name}
													</span>
												</Combobox.ItemText>
											</Combobox.Item>
										{/each}
										{#if filteredLblItems.length === 0}
											<div class="px-3 py-2 text-xs text-surface-400">No labels found</div>
										{/if}
									</Combobox.Content>
								</Combobox.Positioner>
							</Combobox>
						</th>
						<th class="px-3 py-2">
							<input
								type="text"
								bind:value={noteFilter}
								placeholder="Filter note…"
								class="w-full rounded border border-surface-300 px-2 py-1 text-xs font-normal"
							/>
						</th>
						{#if showStatusColumn}
							<th class="px-3 py-2"></th>
						{/if}
					</tr>
				{/if}
			</thead>

			<tbody>
				{#each sortedRows as row (row.id)}
					<tr class="border-b border-surface-200 align-top hover:bg-surface-50">
						<td class="px-3 py-2">
							{#if row.patient}
								{row.patient.last_name}, {row.patient.first_name}
								<span class="text-xs text-surface-500">
									({formatDate(row.patient.date_of_birth)})
								</span>
							{:else}
								—
							{/if}
						</td>
						<td class="px-3 py-2 whitespace-nowrap">{formatDate(row.service_start_date)}</td>
						<td class="px-3 py-2 text-right whitespace-nowrap">
							{formatCurrency(row.billed_amount)}
						</td>
						<td class="px-3 py-2">
							{#if row.insurances.length}
								{row.insurances.map((i) => i.name).join(', ')}
							{:else}
								—
							{/if}
						</td>
						<td class="px-3 py-2">
							{#if row.labels.length}
								<div class="flex flex-wrap gap-1">
									{#each row.labels as lbl}
										<span
											class="rounded px-2 py-0.5 text-xs"
											style="background-color: {lbl.bg_color}; color: {lbl.txt_color};"
										>
											{lbl.label_name}
										</span>
									{/each}
								</div>
							{:else}
								—
							{/if}
						</td>
						<td class="px-3 py-2">
							{#if row.last_note}
								<span class="whitespace-nowrap">
									{formatNoteTimestamp(row.last_note.created_at)}
								</span>
								<span class="font-medium">
									{row.last_note.username ?? 'unknown'}:
								</span>
								<span>{row.last_note.note}</span>
							{:else}
								—
							{/if}
						</td>
						{#if showStatusColumn}
							<td class="px-3 py-2 whitespace-nowrap">
								{#if row.is_closed}
									<span class="rounded bg-surface-200 px-2 py-0.5 text-xs text-surface-600"
										>Closed</span
									>
								{:else}
									<span class="rounded bg-primary-100 px-2 py-0.5 text-xs text-primary-700"
										>Open</span
									>
								{/if}
							</td>
						{/if}
					</tr>
				{:else}
					<tr>
						<td colspan={colSpan} class="px-3 py-8 text-center text-surface-400">
							{#if data.reportData.length === 0 && data.dateMode === 'lastNote'}
								No denials with notes found in this date range.
							{:else if data.reportData.length === 0}
								No denials found in this date range.
							{:else}
								No records match the selected filters.
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	@media print {
		.no-print {
			display: none !important;
		}

		table {
			font-size: 11px;
		}

		th,
		td {
			padding: 4px 6px;
		}
	}

	.sort-btn {
		all: unset;
		cursor: pointer;
		user-select: none;
		font-weight: inherit;
		font-size: inherit;
		line-height: inherit;
	}

	.sort-btn:focus-visible {
		outline: 2px solid var(--color-primary-500);
		outline-offset: 2px;
		border-radius: 2px;
	}
</style>
