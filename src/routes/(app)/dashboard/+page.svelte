<script lang="ts">
	import { formatDate } from '$lib/utils';
	import { invalidateAll } from '$app/navigation';
	import type { FollowUpDenial, NoteWithUser } from '$lib/server/db/followups';

	let { data } = $props();

	const PAGE_SIZE = 10;

	// ── helpers ───────────────────────────────────────────────────────────────

	function daysFromToday(dateStr: string): number {
		const [y, m, d] = dateStr.split('-').map(Number);
		const due = new Date(y, (m ?? 1) - 1, d ?? 1);
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
	}

	function relativeLabel(dateStr: string | null): string {
		if (!dateStr) return '';
		const diff = daysFromToday(dateStr);
		if (diff === 0) return 'Today';
		if (diff === 1) return 'Tomorrow';
		if (diff === -1) return '1 day overdue';
		if (diff < 0) return `${Math.abs(diff)} days overdue`;
		return `in ${diff} days`;
	}

	function getInsurance(denial: FollowUpDenial): string {
		return denial.denials_insurances?.[0]?.insurances?.name ?? '—';
	}

	type LabelData = { id: number; label_name: string; bg_color: string; txt_color: string };

	function getLabels(denial: FollowUpDenial): LabelData[] {
		return (denial.denials_labels ?? [])
			.map((dl) => dl.labels)
			.filter((l): l is LabelData => l != null);
	}

	function formatNoteDate(isoStr: string): string {
		const d = new Date(isoStr);
		const mm = String(d.getMonth() + 1).padStart(2, '0');
		const dd = String(d.getDate()).padStart(2, '0');
		const yy = String(d.getFullYear()).slice(2);
		return `${mm}/${dd}/${yy}`;
	}

	function getLatestNote(denial: FollowUpDenial): string {
		const notes: NoteWithUser[] = denial.notes ?? [];
		if (notes.length === 0) return '—';
		const latest = [...notes].sort(
			(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
		)[0];
		const user = latest.users?.username ?? 'unknown';
		const text = latest.note.length > 60 ? latest.note.slice(0, 60) + '…' : latest.note;
		return `${formatNoteDate(latest.created_at)} ${user}: ${text}`;
	}

	function getLatestNoteTs(denial: FollowUpDenial): string {
		const notes: NoteWithUser[] = denial.notes ?? [];
		if (notes.length === 0) return '';
		return [...notes].sort(
			(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
		)[0].created_at;
	}

	// ── sort ──────────────────────────────────────────────────────────────────

	type SortCol = 'patient' | 'service_start_date' | 'insurance' | 'labels' | 'date' | 'note';

	function sortRows(rows: FollowUpDenial[], col: SortCol, dir: 'asc' | 'desc'): FollowUpDenial[] {
		return [...rows].sort((a, b) => {
			let av = '',
				bv = '';
			switch (col) {
				case 'patient':
					av = `${a.patients?.last_name ?? ''}${a.patients?.first_name ?? ''}`.toLowerCase();
					bv = `${b.patients?.last_name ?? ''}${b.patients?.first_name ?? ''}`.toLowerCase();
					break;
				case 'service_start_date':
					av = a.service_start_date ?? '';
					bv = b.service_start_date ?? '';
					break;
				case 'insurance':
					av = getInsurance(a).toLowerCase();
					bv = getInsurance(b).toLowerCase();
					break;
				case 'labels':
					av = getLabels(a)[0]?.label_name?.toLowerCase() ?? '';
					bv = getLabels(b)[0]?.label_name?.toLowerCase() ?? '';
					break;
				case 'date':
					av = a.follow_up_date ?? a.created_at ?? '';
					bv = b.follow_up_date ?? b.created_at ?? '';
					break;
				case 'note':
					av = getLatestNoteTs(a);
					bv = getLatestNoteTs(b);
					break;
			}
			const cmp = av.localeCompare(bv);
			return dir === 'asc' ? cmp : -cmp;
		});
	}

	// ── filter ────────────────────────────────────────────────────────────────

	function filterRows(
		rows: FollowUpDenial[],
		search: string,
		insuranceId: number,
		labelId: number
	): FollowUpDenial[] {
		return rows.filter((d) => {
			if (search) {
				const name = `${d.patients?.last_name ?? ''} ${d.patients?.first_name ?? ''}`.toLowerCase();
				if (!name.includes(search.toLowerCase())) return false;
			}
			if (insuranceId) {
				if (!d.denials_insurances?.some((di) => di.insurances?.id === insuranceId)) return false;
			}
			if (labelId) {
				if (!(d.denials_labels ?? []).some((dl) => dl.labels?.id === labelId)) return false;
			}
			return true;
		});
	}

	// ── state ─────────────────────────────────────────────────────────────────

	type SectionKey = 'overdue' | 'thisWeek' | 'upcoming' | 'noDate';

	let pages = $state<Record<SectionKey, number>>({
		overdue: 1,
		thisWeek: 1,
		upcoming: 1,
		noDate: 1
	});
	let collapsed = $state<Record<SectionKey, boolean>>({
		overdue: false,
		thisWeek: false,
		upcoming: false,
		noDate: false
	});
	let sorts = $state<Record<SectionKey, { col: SortCol; dir: 'asc' | 'desc' }>>({
		overdue: { col: 'date', dir: 'asc' },
		thisWeek: { col: 'date', dir: 'asc' },
		upcoming: { col: 'date', dir: 'asc' },
		noDate: { col: 'service_start_date', dir: 'desc' }
	});
	let filter = $state({ search: '', insuranceId: 0, labelId: 0 });
	let savingIds = $state<number[]>([]);

	$effect(() => {
		const { search, insuranceId, labelId } = filter;
		void search;
		void insuranceId;
		void labelId;
		pages.overdue = 1;
		pages.thisWeek = 1;
		pages.upcoming = 1;
		pages.noDate = 1;
	});

	function toggleSort(key: SectionKey, col: SortCol) {
		if (sorts[key].col === col) {
			sorts[key].dir = sorts[key].dir === 'asc' ? 'desc' : 'asc';
		} else {
			sorts[key] = { col, dir: 'asc' };
		}
		pages[key] = 1;
	}

	function sortIcon(key: SectionKey, col: SortCol): string {
		if (sorts[key].col !== col) return '↕';
		return sorts[key].dir === 'asc' ? '↑' : '↓';
	}

	// ── filter option lists (derived from loaded data) ─────────────────────

	let allRows = $derived([
		...data.grouped.overdue,
		...data.grouped.thisWeek,
		...data.grouped.upcoming,
		...data.grouped.noDate
	]);

	let uniqueInsurances = $derived(
		(() => {
			const map = new Map<number, string>();
			for (const d of allRows) {
				const ins = d.denials_insurances?.[0]?.insurances;
				if (ins) map.set(ins.id, ins.name);
			}
			return [...map.entries()]
				.map(([id, name]) => ({ id, name }))
				.sort((a, b) => a.name.localeCompare(b.name));
		})()
	);

	let uniqueLabels = $derived(
		(() => {
			const map = new Map<number, LabelData>();
			for (const d of allRows) {
				for (const dl of d.denials_labels ?? []) {
					if (dl.labels) map.set(dl.labels.id, dl.labels);
				}
			}
			return [...map.values()].sort((a, b) => a.label_name.localeCompare(b.label_name));
		})()
	);

	let hasFilter = $derived(!!filter.search || !!filter.insuranceId || !!filter.labelId);

	// ── section configs ───────────────────────────────────────────────────────

	type TableSection = {
		key: SectionKey;
		title: string;
		empty: string;
		rawCount: number;
		filteredRows: FollowUpDenial[];
		leftBorder: string;
		badgeCls: string;
		pillCls: string;
		showFollowUpDate: boolean;
	};

	let tableSections = $derived<TableSection[]>([
		{
			key: 'overdue',
			title: 'Overdue',
			empty: 'Nothing overdue.',
			rawCount: data.grouped.overdue.length,
			filteredRows: filterRows(
				sortRows(data.grouped.overdue, sorts.overdue.col, sorts.overdue.dir),
				filter.search,
				filter.insuranceId,
				filter.labelId
			),
			leftBorder: 'border-l-4 border-l-error-500',
			badgeCls: 'bg-error-100 text-error-700',
			pillCls: 'bg-red-50 border border-red-200 text-red-700 hover:bg-red-100',
			showFollowUpDate: true
		},
		{
			key: 'thisWeek',
			title: 'This Week',
			empty: 'No follow-ups due this week.',
			rawCount: data.grouped.thisWeek.length,
			filteredRows: filterRows(
				sortRows(data.grouped.thisWeek, sorts.thisWeek.col, sorts.thisWeek.dir),
				filter.search,
				filter.insuranceId,
				filter.labelId
			),
			leftBorder: 'border-l-4 border-l-warning-500',
			badgeCls: 'bg-warning-100 text-warning-800',
			pillCls: 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100',
			showFollowUpDate: true
		},
		{
			key: 'upcoming',
			title: 'Upcoming',
			empty: 'No upcoming follow-ups.',
			rawCount: data.grouped.upcoming.length,
			filteredRows: filterRows(
				sortRows(data.grouped.upcoming, sorts.upcoming.col, sorts.upcoming.dir),
				filter.search,
				filter.insuranceId,
				filter.labelId
			),
			leftBorder: 'border-l-4 border-l-primary-500',
			badgeCls: 'bg-primary-100 text-primary-700',
			pillCls: 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100',
			showFollowUpDate: true
		},
		{
			key: 'noDate',
			title: 'No Follow-up Date',
			empty: 'All open denials have a follow-up date set.',
			rawCount: data.grouped.noDate.length,
			filteredRows: filterRows(
				sortRows(data.grouped.noDate, sorts.noDate.col, sorts.noDate.dir),
				filter.search,
				filter.insuranceId,
				filter.labelId
			),
			leftBorder: 'border-l-4 border-l-surface-300',
			badgeCls: 'bg-surface-100 text-surface-600',
			pillCls: 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100',
			showFollowUpDate: false
		}
	]);

	// ── date picker save ──────────────────────────────────────────────────────

	async function setFollowUpDate(denialId: number, value: string) {
		if (!value) return;
		savingIds = [...savingIds, denialId];
		try {
			const res = await fetch(`/api/v1/denials/${denialId}/follow-up-date`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ follow_up_date: value })
			});
			if (res.ok) {
				await invalidateAll();
			}
		} finally {
			savingIds = savingIds.filter((id) => id !== denialId);
		}
	}

	// ── pagination ────────────────────────────────────────────────────────────

	function paginate<T>(rows: T[], page: number): T[] {
		return rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
	}

	function totalPagesFor(count: number): number {
		return Math.max(1, Math.ceil(count / PAGE_SIZE));
	}
</script>

<svelte:head>
	<title>Dashboard | Denials Tracker</title>
</svelte:head>

<div class="space-y-5">
	<!-- Header -->
	<h1 class="text-2xl font-bold text-surface-900">Dashboard</h1>

	<!-- Summary Bar -->
	<div class="flex flex-wrap gap-2">
		{#each tableSections as s (s.key)}
			<button
				onclick={() =>
					document
						.getElementById(`section-${s.key}`)
						?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
				class="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors {s.pillCls}"
			>
				{s.title}
				<span class="rounded-full bg-white/60 px-1.5 py-0.5 text-xs font-bold">{s.rawCount}</span>
			</button>
		{/each}
	</div>

	<!-- Filter Bar -->
	<div
		class="flex flex-wrap items-center gap-3 rounded-xl border border-surface-200 bg-white px-4 py-3 shadow-sm"
	>
		<div class="flex min-w-45 flex-1 items-center gap-2">
			<span class="text-sm text-surface-400">🔍</span>
			<input
				type="text"
				placeholder="Search patient name…"
				bind:value={filter.search}
				class="w-full border-none bg-transparent text-sm text-surface-900 outline-none placeholder:text-surface-400"
			/>
		</div>

		{#if uniqueInsurances.length > 0}
			<select
				bind:value={filter.insuranceId}
				class="w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-1.5 text-sm text-surface-700 focus:outline-none sm:w-auto"
			>
				<option value={0}>All Insurances</option>
				{#each uniqueInsurances as ins (ins.id)}
					<option value={ins.id}>{ins.name}</option>
				{/each}
			</select>
		{/if}

		{#if uniqueLabels.length > 0}
			<select
				bind:value={filter.labelId}
				class="w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-1.5 text-sm text-surface-700 focus:outline-none sm:w-auto"
			>
				<option value={0}>All Labels</option>
				{#each uniqueLabels as lbl (lbl.id)}
					<option value={lbl.id}>{lbl.label_name}</option>
				{/each}
			</select>
		{/if}

		{#if hasFilter}
			<button
				onclick={() => {
					filter.search = '';
					filter.insuranceId = 0;
					filter.labelId = 0;
				}}
				class="rounded-lg px-2 py-1.5 text-xs text-surface-500 transition-colors hover:bg-error-50 hover:text-error-600"
			>
				✕ Clear
			</button>
		{/if}
	</div>

	<!-- Sections -->
	{#each tableSections as section (section.key)}
		{@const currentPage = pages[section.key]}
		{@const total = totalPagesFor(section.filteredRows.length)}
		{@const isCollapsed = collapsed[section.key]}
		{@const visibleRows = paginate(section.filteredRows, currentPage)}

		<section
			id="section-{section.key}"
			class="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-sm {section.leftBorder}"
		>
			<!-- Section Header -->
			<div class="flex items-center gap-3 border-b border-surface-200 px-5 py-3">
				<button
					onclick={() => (collapsed[section.key] = !collapsed[section.key])}
					class="text-xs text-surface-400 transition-transform duration-200 {isCollapsed
						? ''
						: 'rotate-90'}"
					aria-label="Toggle {section.title}"
				>
					▶
				</button>
				<h2 class="text-base font-semibold text-surface-900">{section.title}</h2>
				<span class="rounded-full px-2 py-0.5 text-xs font-semibold {section.badgeCls}">
					{section.filteredRows.length}{hasFilter &&
					section.filteredRows.length !== section.rawCount
						? ` / ${section.rawCount}`
						: ''}
				</span>
			</div>

			{#if !isCollapsed}
				{#if section.filteredRows.length === 0}
					<p class="px-5 py-4 text-sm text-surface-400">
						{hasFilter ? 'No results match the current filter.' : section.empty}
					</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full min-w-175 table-fixed text-sm">
							<colgroup>
								<col class="w-[20%]" />
								<col class="w-[10%]" />
								<col class="w-[13%]" />
								<col class="w-[12%]" />
								<col class="w-[15%]" />
								<col class="w-[30%]" />
							</colgroup>
							<thead>
								<tr
									class="bg-surface-50 text-xs font-semibold tracking-wide text-surface-500 uppercase"
								>
									<th
										class="cursor-pointer px-4 py-2.5 text-left hover:text-surface-700"
										onclick={() => toggleSort(section.key, 'patient')}
									>
										Patient <span class="text-surface-300">{sortIcon(section.key, 'patient')}</span>
									</th>
									<th
										class="cursor-pointer px-4 py-2.5 text-left hover:text-surface-700"
										onclick={() => toggleSort(section.key, 'service_start_date')}
									>
										Date of Service <span class="text-surface-300"
											>{sortIcon(section.key, 'service_start_date')}</span
										>
									</th>
									<th
										class="cursor-pointer px-4 py-2.5 text-left hover:text-surface-700"
										onclick={() => toggleSort(section.key, 'insurance')}
									>
										Insurance <span class="text-surface-300"
											>{sortIcon(section.key, 'insurance')}</span
										>
									</th>
									<th
										class="cursor-pointer px-4 py-2.5 text-left hover:text-surface-700"
										onclick={() => toggleSort(section.key, 'labels')}
									>
										Labels <span class="text-surface-300">{sortIcon(section.key, 'labels')}</span>
									</th>
									{#if section.showFollowUpDate}
										<th
											class="cursor-pointer px-4 py-2.5 text-left hover:text-surface-700"
											onclick={() => toggleSort(section.key, 'date')}
										>
											Follow-up Date <span class="text-surface-300"
												>{sortIcon(section.key, 'date')}</span
											>
										</th>
									{:else}
										<th class="px-4 py-2.5 text-left">Set Follow-up</th>
									{/if}
									<th
										class="cursor-pointer px-4 py-2.5 text-left hover:text-surface-700"
										onclick={() => toggleSort(section.key, 'note')}
									>
										Latest Note <span class="text-surface-300">{sortIcon(section.key, 'note')}</span
										>
									</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-surface-100">
								{#each visibleRows as denial (denial.id)}
									{@const patient = denial.patients}
									{@const labels = getLabels(denial)}
									{@const isSaving = savingIds.includes(denial.id)}
									<tr class="transition-colors hover:bg-surface-50">
										<!-- Patient -->
										<td class="px-4 py-2.5">
											<a
												href="/record/{denial.patient_id}"
												class="block font-medium text-surface-900 hover:text-primary-600"
											>
												{patient?.last_name ?? 'Unknown'}, {patient?.first_name ?? ''}
											</a>
											{#if patient?.date_of_birth}
												<div class="text-xs text-surface-400">
													{formatDate(patient.date_of_birth)}
												</div>
											{/if}
										</td>
										<!-- Date of Service -->
										<td class="px-4 py-2.5 text-surface-600">
											{formatDate(denial.service_start_date)}
										</td>
										<!-- Insurance -->
										<td class="truncate px-4 py-2.5 text-surface-600">
											{getInsurance(denial)}
										</td>
										<!-- Labels -->
										<td class="px-4 py-2.5">
											{#if labels.length === 0}
												<span class="text-surface-300">—</span>
											{:else}
												<div class="flex flex-wrap gap-1">
													{#each labels as lbl (lbl.id)}
														<span
															class="rounded-full px-1.5 py-0.5 text-xs leading-none font-medium"
															style="background-color:{lbl.bg_color};color:{lbl.txt_color}"
														>
															{lbl.label_name}
														</span>
													{/each}
												</div>
											{/if}
										</td>
										<!-- Follow-up Date or Date Picker -->
										<td class="px-4 py-2.5">
											{#if section.showFollowUpDate}
												<span class="text-surface-900">{formatDate(denial.follow_up_date)}</span>
												<div class="text-xs text-surface-400">
													{relativeLabel(denial.follow_up_date)}
												</div>
											{:else}
												<input
													type="date"
													disabled={isSaving}
													onchange={(e) =>
														setFollowUpDate(denial.id, (e.currentTarget as HTMLInputElement).value)}
													class="w-full rounded border border-surface-200 bg-surface-50 px-2 py-1 text-xs text-surface-700 focus:border-primary-400 focus:outline-none disabled:opacity-50"
												/>
												{#if isSaving}
													<div class="mt-0.5 text-xs text-surface-400">Saving…</div>
												{/if}
											{/if}
										</td>
										<!-- Latest Note -->
										<td class="px-4 py-2.5">
											<span class="block truncate text-xs text-surface-500">
												{getLatestNote(denial)}
											</span>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Pagination -->
					{#if total > 1}
						<div class="flex items-center justify-between border-t border-surface-100 px-5 py-2.5">
							<span class="text-xs text-surface-400">
								{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(
									currentPage * PAGE_SIZE,
									section.filteredRows.length
								)} of {section.filteredRows.length}
							</span>
							<div class="flex items-center gap-1">
								<button
									onclick={() => (pages[section.key] = currentPage - 1)}
									disabled={currentPage === 1}
									class="rounded px-2 py-1 text-xs font-medium text-surface-600 hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-40"
								>
									← Prev
								</button>
								<span class="px-2 text-xs text-surface-600">{currentPage} / {total}</span>
								<button
									onclick={() => (pages[section.key] = currentPage + 1)}
									disabled={currentPage === total}
									class="rounded px-2 py-1 text-xs font-medium text-surface-600 hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-40"
								>
									Next →
								</button>
							</div>
						</div>
					{/if}
				{/if}
			{/if}
		</section>
	{/each}
</div>
