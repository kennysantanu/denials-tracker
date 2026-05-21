<script lang="ts">
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { Combobox, Popover } from '@skeletonlabs/skeleton-svelte';
	import { ListCollection } from '@zag-js/collection';
	import { formatDate } from '$lib/utils';
	import { setChatContext } from '$lib/stores/chatContext.svelte';
	import type { ReportRow } from '$lib/server/db/reports';

	let { data } = $props();

	// -- column definitions ----------------------------------------------------

	type ColKey =
		| 'patient'
		| 'service_date'
		| 'follow_up_date'
		| 'billed'
		| 'insurances'
		| 'labels'
		| 'last_note'
		| 'status';

	const ALL_COLS: { key: ColKey; label: string }[] = [
		{ key: 'patient', label: 'Patient' },
		{ key: 'service_date', label: 'Service Date' },
		{ key: 'follow_up_date', label: 'Follow-up Date' },
		{ key: 'billed', label: 'Billed Amount' },
		{ key: 'insurances', label: 'Insurance' },
		{ key: 'labels', label: 'Labels' },
		{ key: 'last_note', label: 'Last Note' },
		{ key: 'status', label: 'Status' }
	];

	type Preset = 'all' | 'followup' | 'billing' | 'activity';

	const PRESETS: Record<Preset, { label: string; cols: ColKey[] }> = {
		all: {
			label: 'All',
			cols: [
				'patient',
				'service_date',
				'follow_up_date',
				'billed',
				'insurances',
				'labels',
				'last_note'
			]
		},
		followup: {
			label: 'Follow-up',
			cols: ['patient', 'follow_up_date', 'insurances', 'labels']
		},
		billing: {
			label: 'Billing',
			cols: ['patient', 'service_date', 'billed', 'insurances']
		},
		activity: {
			label: 'Activity',
			cols: ['patient', 'service_date', 'insurances', 'last_note']
		}
	};

	const STORAGE_KEY = 'report_visible_cols';

	// -- date range presets ---------------------------------------------------

	type DatePresetKey = 'today' | 'last_30' | 'last_90' | 'this_year' | 'last_year';

	function toDateStr(d: Date): string {
		return d.toISOString().slice(0, 10);
	}

	const DATE_PRESETS: {
		key: DatePresetKey;
		label: string;
		getDates: () => { start: string; end: string };
	}[] = [
		{
			key: 'today',
			label: 'Today',
			getDates: () => {
				const today = toDateStr(new Date());
				return { start: today, end: today };
			}
		},
		{
			key: 'last_30',
			label: 'Last 30 Days',
			getDates: () => {
				const end = new Date();
				end.setHours(0, 0, 0, 0);
				const start = new Date(end);
				start.setDate(start.getDate() - 29);
				return { start: toDateStr(start), end: toDateStr(end) };
			}
		},
		{
			key: 'last_90',
			label: 'Last 90 Days',
			getDates: () => {
				const end = new Date();
				end.setHours(0, 0, 0, 0);
				const start = new Date(end);
				start.setDate(start.getDate() - 89);
				return { start: toDateStr(start), end: toDateStr(end) };
			}
		},
		{
			key: 'this_year',
			label: 'This Year',
			getDates: () => {
				const y = new Date().getFullYear();
				return { start: `${y}-01-01`, end: `${y}-12-31` };
			}
		},
		{
			key: 'last_year',
			label: 'Last Year',
			getDates: () => {
				const y = new Date().getFullYear() - 1;
				return { start: `${y}-01-01`, end: `${y}-12-31` };
			}
		}
	];

	function applyDatePreset(key: DatePresetKey) {
		const preset = DATE_PRESETS.find((p) => p.key === key);
		if (!preset) return;
		const { start, end } = preset.getDates();
		startDate = start;
		endDate = end;
	}

	let activeDatePreset = $derived.by<DatePresetKey | null>(() => {
		const match = DATE_PRESETS.find((p) => {
			const { start, end } = p.getDates();
			return start === startDate && end === endDate;
		});
		return match?.key ?? null;
	});

	function loadStoredCols(): ColKey[] | null {
		if (typeof localStorage === 'undefined') return null;
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as unknown;
			if (!Array.isArray(parsed)) return null;
			const valid = ALL_COLS.map((c) => c.key);
			const filtered = (parsed as string[]).filter((k): k is ColKey => valid.includes(k as ColKey));
			return filtered.length > 0 ? filtered : null;
		} catch {
			return null;
		}
	}

	// -- sort / filter / url types ---------------------------------------------

	type SortKey = ColKey;
	const VALID_SORT_KEYS: SortKey[] = ALL_COLS.map((c) => c.key);

	type FollowUpUrgency = 'all' | 'overdue' | 'today' | 'this_week' | 'upcoming' | 'none';
	const VALID_FOLLOW_UP_URGENCIES: FollowUpUrgency[] = [
		'all',
		'overdue',
		'today',
		'this_week',
		'upcoming',
		'none'
	];

	const seed = untrack(() => {
		const sp = new URL(page.url).searchParams;
		const sk = sp.get('sortKey');
		const presetParam = sp.get('preset') as Preset | null;
		const fuu = sp.get('fuu') as FollowUpUrgency | null;
		const bminRaw = sp.get('bmin');
		const bmaxRaw = sp.get('bmax');
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
			showFilters: sp.get('sf') === '1',
			preset: (presetParam && presetParam in PRESETS ? presetParam : 'all') as Preset,
			showAll: sp.get('all') === '1',
			followUpUrgency: fuu && VALID_FOLLOW_UP_URGENCIES.includes(fuu) ? fuu : 'all',
			followUpStart: sp.get('fus') ?? '',
			followUpEnd: sp.get('fue') ?? '',
			serviceDateStart: sp.get('sds') ?? '',
			serviceDateEnd: sp.get('sde') ?? '',
			billedMin: bminRaw !== null ? parseFloat(bminRaw) : NaN,
			billedMax: bmaxRaw !== null ? parseFloat(bmaxRaw) : NaN,
			noteStart: sp.get('lns') ?? '',
			noteEnd: sp.get('lne') ?? '',
			statusFilter: (sp.get('st') === 'open'
				? 'open'
				: sp.get('st') === 'closed'
					? 'closed'
					: 'all') as 'all' | 'open' | 'closed'
		};
	});

	let startDate = $state(seed.startDate);
	let endDate = $state(seed.endDate);
	let showAll = $state(seed.showAll);
	let includeClosed = $state(seed.includeClosed);
	let dateMode = $state<'service' | 'lastNote'>(seed.dateMode);
	let activePreset = $state<Preset>(seed.preset);
	let visibleCols = $state<ColKey[]>(loadStoredCols() ?? PRESETS[seed.preset].cols);

	function applyPreset(p: Preset) {
		activePreset = p;
		visibleCols = [...PRESETS[p].cols];
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleCols));
		}
	}

	function toggleCol(key: ColKey) {
		if (visibleCols.includes(key)) {
			if (visibleCols.length === 1) return;
			visibleCols = visibleCols.filter((k) => k !== key);
		} else {
			const order = ALL_COLS.map((c) => c.key);
			visibleCols = order.filter((k) => visibleCols.includes(k) || k === key);
		}
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleCols));
		}
		const match = (Object.keys(PRESETS) as Preset[]).find(
			(p) =>
				PRESETS[p].cols.length === visibleCols.length &&
				PRESETS[p].cols.every((k, i) => visibleCols[i] === k)
		);
		activePreset = match ?? 'all';
	}

	function generateReport() {
		const url = new URL('/report', page.url);
		if (showAll) {
			url.searchParams.set('all', '1');
		} else {
			url.searchParams.set('startDate', startDate);
			url.searchParams.set('endDate', endDate);
		}
		url.searchParams.set('includeClosed', String(includeClosed));
		url.searchParams.set('dateMode', dateMode);
		applyClientQueryState(url);
		goto(url);
	}

	function formatCurrency(value: number | null | undefined): string {
		if (value == null) return '$0.00';
		return (
			'$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
		);
	}

	function formatNoteTimestamp(iso: string): string {
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '';
		return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
	}

	// -- follow-up urgency -----------------------------------------------------

	function daysFromToday(dateStr: string): number {
		const [y, m, d] = dateStr.split('-').map(Number);
		const due = new Date(y, (m ?? 1) - 1, d ?? 1);
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
	}

	function followUpBadge(dateStr: string | null): { label: string; cls: string } | null {
		if (!dateStr) return null;
		const diff = daysFromToday(dateStr);
		if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, cls: 'badge preset-tonal-error' };
		if (diff === 0) return { label: 'Today', cls: 'badge preset-tonal-warning' };
		if (diff <= 7) return { label: `${diff}d`, cls: 'badge preset-tonal-warning' };
		return null;
	}

	// -- sort ------------------------------------------------------------------

	let sortKey = $state<SortKey>(
		seed.sortKey ?? (seed.dateMode === 'lastNote' ? 'last_note' : 'service_date')
	);
	let sortDir = $state<'asc' | 'desc'>(seed.sortDir ?? 'desc');

	function toggleSort(key: SortKey) {
		if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else {
			sortKey = key;
			sortDir = 'asc';
		}
	}

	function sortAriaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
		if (sortKey !== key) return 'none';
		return sortDir === 'asc' ? 'ascending' : 'descending';
	}

	function sortIndicator(key: SortKey): string {
		if (sortKey !== key) return '';
		return sortDir === 'asc' ? '↑' : '↓';
	}

	// -- client filters --------------------------------------------------------

	let patientFilter = $state(seed.patientFilter);
	let patientFilterRaw = $state(seed.patientFilter);
	let noteFilter = $state(seed.noteFilter);
	let noteFilterRaw = $state(seed.noteFilter);
	let insuranceFilter = $state<number[]>(seed.insuranceFilter);
	let labelFilter = $state<number[]>(seed.labelFilter);
	let showFilters = $state(seed.showFilters);
	let showMoreFilters = $state(false);
	let followUpUrgency = $state<FollowUpUrgency>(seed.followUpUrgency);
	let followUpStart = $state(seed.followUpStart);
	let followUpEnd = $state(seed.followUpEnd);
	let serviceDateStart = $state(seed.serviceDateStart);
	let serviceDateEnd = $state(seed.serviceDateEnd);
	let billedMin = $state<number>(seed.billedMin);
	let billedMax = $state<number>(seed.billedMax);
	let noteStart = $state(seed.noteStart);
	let noteEnd = $state(seed.noteEnd);
	let statusFilter = $state<'all' | 'open' | 'closed'>(seed.statusFilter);

	// debounce text filter inputs
	$effect(() => {
		const v = patientFilterRaw;
		const t = setTimeout(() => {
			patientFilter = v;
		}, 150);
		return () => clearTimeout(t);
	});
	$effect(() => {
		const v = noteFilterRaw;
		const t = setTimeout(() => {
			noteFilter = v;
		}, 150);
		return () => clearTimeout(t);
	});

	function clearFilters() {
		patientFilter = '';
		patientFilterRaw = '';
		noteFilter = '';
		noteFilterRaw = '';
		insuranceFilter = [];
		labelFilter = [];
		insSearchInput = '';
		lblSearchInput = '';
		followUpUrgency = 'all';
		followUpStart = '';
		followUpEnd = '';
		serviceDateStart = '';
		serviceDateEnd = '';
		billedMin = NaN;
		billedMax = NaN;
		noteStart = '';
		noteEnd = '';
		statusFilter = 'all';
	}

	type FilterChip = { key: string; label: string; clear: () => void };

	const activeFilterChips = $derived.by<FilterChip[]>(() => {
		const chips: FilterChip[] = [];
		if (patientFilter.trim())
			chips.push({
				key: 'patient',
				label: `Patient: "${patientFilter.trim()}"`,
				clear: () => {
					patientFilter = '';
					patientFilterRaw = '';
				}
			});
		if (noteFilter.trim())
			chips.push({
				key: 'note',
				label: `Note: "${noteFilter.trim()}"`,
				clear: () => {
					noteFilter = '';
					noteFilterRaw = '';
				}
			});
		if (statusFilter !== 'all')
			chips.push({
				key: 'status',
				label: `Status: ${statusFilter === 'open' ? 'Open' : 'Closed'}`,
				clear: () => {
					statusFilter = 'all';
				}
			});
		if (followUpUrgency !== 'all') {
			const urgencyLabels: Record<FollowUpUrgency, string> = {
				all: 'All',
				overdue: 'Overdue',
				today: 'Due Today',
				this_week: 'Due This Week',
				upcoming: 'Upcoming',
				none: 'No Date'
			};
			chips.push({
				key: 'fuu',
				label: `Follow-up: ${urgencyLabels[followUpUrgency]}`,
				clear: () => {
					followUpUrgency = 'all';
				}
			});
		}
		if (followUpStart || followUpEnd)
			chips.push({
				key: 'fud',
				label: `Follow-up: ${followUpStart || '...'} to ${followUpEnd || '...'}`,
				clear: () => {
					followUpStart = '';
					followUpEnd = '';
				}
			});
		if (serviceDateStart || serviceDateEnd)
			chips.push({
				key: 'sd',
				label: `Service: ${serviceDateStart || '...'} to ${serviceDateEnd || '...'}`,
				clear: () => {
					serviceDateStart = '';
					serviceDateEnd = '';
				}
			});
		if (!isNaN(billedMin) || !isNaN(billedMax)) {
			const min = isNaN(billedMin) ? '$0' : `$${billedMin}`;
			const max = isNaN(billedMax) ? 'no limit' : `$${billedMax}`;
			chips.push({
				key: 'billed',
				label: `Billed: ${min} to ${max}`,
				clear: () => {
					billedMin = NaN;
					billedMax = NaN;
				}
			});
		}
		if (noteStart || noteEnd)
			chips.push({
				key: 'nd',
				label: `Note date: ${noteStart || '...'} to ${noteEnd || '...'}`,
				clear: () => {
					noteStart = '';
					noteEnd = '';
				}
			});
		for (const id of insuranceFilter) {
			const ins = availableInsurances.find((i) => i.id === id);
			chips.push({
				key: `ins_${id}`,
				label: `Insurance: ${ins?.name ?? id}`,
				clear: () => {
					insuranceFilter = insuranceFilter.filter((i) => i !== id);
				}
			});
		}
		for (const id of labelFilter) {
			const lbl = availableLabels.find((l) => l.id === id);
			chips.push({
				key: `lbl_${id}`,
				label: `Label: ${lbl?.name ?? id}`,
				clear: () => {
					labelFilter = labelFilter.filter((l) => l !== id);
				}
			});
		}
		return chips;
	});

	const hasActiveFilters = $derived(activeFilterChips.length > 0);

	function exportCsv() {
		const headers = ALL_COLS.filter((c) => visibleCols.includes(c.key)).map((c) => c.label);
		const rows = sortedRows.map((r) =>
			visibleCols
				.map((col) => {
					switch (col) {
						case 'patient':
							return r.patient ? `"${r.patient.last_name}, ${r.patient.first_name}"` : '';
						case 'service_date':
							return r.service_start_date ? formatDate(r.service_start_date) : '';
						case 'follow_up_date':
							return r.follow_up_date ? formatDate(r.follow_up_date) : '';
						case 'billed':
							return r.billed_amount != null ? r.billed_amount.toFixed(2) : '0.00';
						case 'insurances':
							return `"${r.insurances.map((i) => i.name).join('; ')}"`;
						case 'labels':
							return `"${r.labels.map((l) => l.label_name).join('; ')}"`;
						case 'last_note':
							return r.last_note ? `"${r.last_note.note.replace(/"/g, '""')}"` : '';
						case 'status':
							return r.is_closed ? 'Closed' : 'Open';
						default:
							return '';
					}
				})
				.join(',')
		);
		const csv = [headers.join(','), ...rows].join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `denials-tracker-report-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
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
			if (followUpUrgency !== 'all') {
				if (followUpUrgency === 'none') {
					if (r.follow_up_date) return false;
				} else {
					if (!r.follow_up_date) return false;
					const diff = daysFromToday(r.follow_up_date);
					if (followUpUrgency === 'overdue' && diff >= 0) return false;
					if (followUpUrgency === 'today' && diff !== 0) return false;
					if (followUpUrgency === 'this_week' && (diff < 0 || diff > 7)) return false;
					if (followUpUrgency === 'upcoming' && diff <= 7) return false;
				}
			}
			if (followUpStart || followUpEnd) {
				if (!r.follow_up_date) return false;
				if (followUpStart && r.follow_up_date < followUpStart) return false;
				if (followUpEnd && r.follow_up_date > followUpEnd) return false;
			}
			if (serviceDateStart && (r.service_start_date ?? '') < serviceDateStart) return false;
			if (serviceDateEnd && (r.service_start_date ?? '') > serviceDateEnd) return false;
			if (!isNaN(billedMin) && (r.billed_amount ?? 0) < billedMin) return false;
			if (!isNaN(billedMax) && (r.billed_amount ?? 0) > billedMax) return false;
			if (noteStart || noteEnd) {
				const noteDate = r.last_note?.created_at?.slice(0, 10) ?? '';
				if (!noteDate) return false;
				if (noteStart && noteDate < noteStart) return false;
				if (noteEnd && noteDate > noteEnd) return false;
			}
			if (statusFilter !== 'all') {
				if (statusFilter === 'open' && r.is_closed) return false;
				if (statusFilter === 'closed' && !r.is_closed) return false;
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
				case 'follow_up_date': {
					const aDate = a.follow_up_date ?? null;
					const bDate = b.follow_up_date ?? null;
					if (!aDate && !bDate) return 0;
					if (!aDate) return 1;
					if (!bDate) return -1;
					return aDate.localeCompare(bDate) * dir;
				}
				case 'billed':
					return ((a.billed_amount ?? 0) - (b.billed_amount ?? 0)) * dir;
				case 'insurances':
					return insurancesText(a).localeCompare(insurancesText(b)) * dir;
				case 'labels':
					return labelsText(a).localeCompare(labelsText(b)) * dir;
				case 'last_note':
					return (a.last_note?.created_at ?? '').localeCompare(b.last_note?.created_at ?? '') * dir;
				case 'status':
					return (Number(a.is_closed) - Number(b.is_closed)) * dir;
				default:
					return 0;
			}
		});
		return rows;
	});

	const colSpan = $derived(visibleCols.length);

	function applyClientQueryState(url: URL) {
		const sp = url.searchParams;
		sp.set('sortKey', sortKey);
		sp.set('sortDir', sortDir);
		sp.set('preset', activePreset);
		if (showAll) sp.set('all', '1');
		else sp.delete('all');
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
		if (followUpUrgency !== 'all') sp.set('fuu', followUpUrgency);
		else sp.delete('fuu');
		if (followUpStart) sp.set('fus', followUpStart);
		else sp.delete('fus');
		if (followUpEnd) sp.set('fue', followUpEnd);
		else sp.delete('fue');
		if (serviceDateStart) sp.set('sds', serviceDateStart);
		else sp.delete('sds');
		if (serviceDateEnd) sp.set('sde', serviceDateEnd);
		else sp.delete('sde');
		if (!isNaN(billedMin)) sp.set('bmin', String(billedMin));
		else sp.delete('bmin');
		if (!isNaN(billedMax)) sp.set('bmax', String(billedMax));
		else sp.delete('bmax');
		if (noteStart) sp.set('lns', noteStart);
		else sp.delete('lns');
		if (noteEnd) sp.set('lne', noteEnd);
		else sp.delete('lne');
		if (statusFilter !== 'all') sp.set('st', statusFilter);
		else sp.delete('st');
	}

	$effect(() => {
		const url = untrack(() => new URL(page.url));
		applyClientQueryState(url);
		const nextUrl = url.toString();
		const currentUrl = untrack(() => page.url.toString());
		if (nextUrl === currentUrl) return;
		replaceState(
			url,
			untrack(() => page.state)
		);
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
	<!-- Page header -->
	<header class="flex items-end justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold tracking-tight text-surface-900">Report</h1>
			<p class="text-sm text-surface-500">Denial records for the selected date range.</p>
		</div>
		<div class="no-print flex gap-2">
			<button class="btn preset-tonal btn-sm" onclick={exportCsv}>Export CSV</button>
			<button class="btn preset-tonal btn-sm" onclick={() => window.print()}>Print</button>
		</div>
	</header>

	<!-- â”€â”€ Data Source card (server-side, requires Generate) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
	<div class="no-print space-y-3 card border border-surface-200 bg-white p-4 shadow-sm">
		<h2 class="text-xs font-semibold tracking-wide text-surface-500 uppercase">Data Source</h2>
		<div class="flex flex-wrap items-end gap-4">
			<!-- Date Mode -->
			<div class="flex flex-col gap-1">
				<span class="text-xs font-medium text-surface-600">Date Mode</span>
				<div class="flex gap-1">
					{#each [{ v: 'service', l: 'Service Date' }, { v: 'lastNote', l: 'Last Note' }] as item (item.v)}
						<button
							type="button"
							onclick={() => {
								dateMode = item.v as 'service' | 'lastNote';
							}}
							class="btn btn-sm {dateMode === item.v ? 'preset-tonal-primary' : 'hover:preset-tonal'}">{item.l}</button
						>
					{/each}
				</div>
			</div>

			<!-- Quick Range -->
			<div class="flex flex-col gap-1">
				<span class="text-xs font-medium text-surface-600">Quick Range</span>
				<div class="flex flex-wrap gap-1">
					<button
						onclick={() => {
							showAll = true;
						}}
						class="btn btn-sm {showAll ? 'preset-tonal-primary' : 'hover:preset-tonal'}">All</button
					>
					{#each DATE_PRESETS as p (p.key)}
						<button
							onclick={() => {
								showAll = false;
								applyDatePreset(p.key);
							}}
							class="btn btn-sm {!showAll && activeDatePreset === p.key ? 'preset-tonal-primary' : 'hover:preset-tonal'}">{p.label}</button
						>
					{/each}
				</div>
			</div>

			<!-- Start / End dates -->
			<div class="flex gap-3 {showAll ? 'pointer-events-none opacity-40' : ''}">
				<label class="label">
					<span class="label-text text-xs">Start Date</span>
					<input
						id="startDate"
						type="date"
						bind:value={startDate}
						disabled={showAll}
						oninput={() => (showAll = false)}
						class="input text-sm"
					/>
				</label>
				<label class="label">
					<span class="label-text text-xs">End Date</span>
					<input
						id="endDate"
						type="date"
						bind:value={endDate}
						disabled={showAll}
						oninput={() => (showAll = false)}
						class="input text-sm"
					/>
				</label>
			</div>

			<!-- Include Closed -->
			<label class="flex items-center gap-2 pb-1.5 text-sm text-surface-700">
				<input type="checkbox" bind:checked={includeClosed} class="rounded-base" />
				Include Closed
			</label>

			<!-- Generate -->
			<button onclick={generateReport} class="mb-0.5 btn self-end preset-filled-primary-500 btn-sm">
				Generate Report
			</button>
		</div>
	</div>

	<!-- â”€â”€ Filters & View card (client-side, instant) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
	<div
		class="no-print relative z-20 space-y-3 card border border-surface-200 bg-white p-4 shadow-sm"
	>
		<div class="flex items-center justify-between gap-2">
			<h2 class="text-xs font-semibold tracking-wide text-surface-500 uppercase">Filters & View</h2>
			<div class="flex items-center gap-2">
				<span class="text-sm text-surface-500">
					Showing <strong class="text-surface-700">{sortedRows.length}</strong> of
					<strong class="text-surface-700">{data.reportData.length}</strong>
				</span>
				{#if hasActiveFilters}
					<button class="btn preset-tonal-error btn-sm" onclick={clearFilters}>Clear all</button>
				{/if}
				<button class="btn preset-tonal btn-sm" onclick={() => (showFilters = !showFilters)}>
					{showFilters ? 'Hide Filters' : 'Filters'}
				</button>
			</div>
		</div>

		{#if showFilters}
			<div class="space-y-3 border-t border-surface-100 pt-3">
				<!-- Row 1: Search + Status -->
				<div class="flex flex-wrap gap-3">
					<label class="label min-w-40 flex-1">
						<span class="label-text text-xs">Patient</span>
						<input
							type="text"
							bind:value={patientFilterRaw}
							placeholder="Search by name..."
							class="input text-sm"
						/>
					</label>
					<label class="label min-w-40 flex-1">
						<span class="label-text text-xs">Note</span>
						<input
							type="text"
							bind:value={noteFilterRaw}
							placeholder="Search notes..."
							class="input text-sm"
						/>
					</label>
					<div class="flex flex-col gap-1">
						<span class="text-xs font-medium text-surface-600">Status</span>
						<div class="flex gap-1">
							{#each [{ v: 'all', l: 'All' }, { v: 'open', l: 'Open' }, { v: 'closed', l: 'Closed' }] as item (item.v)}
								<button
									type="button"
									onclick={() => {
										statusFilter = item.v as 'all' | 'open' | 'closed';
									}}
									class="btn btn-sm {statusFilter === item.v ? 'preset-tonal-primary' : 'hover:preset-tonal'}">{item.l}</button
								>
							{/each}
						</div>
					</div>
				</div>

				<!-- Row 2: Insurance + Labels + Follow-up urgency -->
				<div class="flex flex-wrap gap-3">
					<div class="flex min-w-48 flex-1 flex-col gap-1">
						<span class="text-xs font-medium text-surface-600">
							Insurance{insuranceFilter.length > 0 ? ` (${insuranceFilter.length})` : ''}
						</span>
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
							placeholder="Filter by insurance..."
							closeOnSelect={false}
						>
							<Combobox.Control>
								<Combobox.Input
									class="input w-full bg-white text-sm placeholder:text-surface-400 focus:outline-none"
								/>
							</Combobox.Control>
							<Combobox.Positioner>
								<Combobox.Content
									class="z-50 max-h-48 overflow-auto rounded-container border border-surface-200 bg-white shadow-lg"
								>
									{#each filteredInsItems as ins (ins.id)}
										<Combobox.Item
											item={ins}
											class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-100 data-highlighted:bg-surface-100"
										>
											<Combobox.ItemIndicator>
												<svg
													class="h-3.5 w-3.5 text-primary-600"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
													stroke-width="2.5"
													><path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M5 13l4 4L19 7"
													/></svg
												>
											</Combobox.ItemIndicator>
											<Combobox.ItemText>{ins.name}</Combobox.ItemText>
										</Combobox.Item>
									{/each}
									{#if filteredInsItems.length === 0}
										<div class="px-3 py-2 text-sm text-surface-400">No insurances found</div>
									{/if}
								</Combobox.Content>
							</Combobox.Positioner>
						</Combobox>
					</div>

					<div class="flex min-w-48 flex-1 flex-col gap-1">
						<span class="text-xs font-medium text-surface-600">
							Labels{labelFilter.length > 0 ? ` (${labelFilter.length})` : ''}
						</span>
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
							placeholder="Filter by label..."
							closeOnSelect={false}
						>
							<Combobox.Control>
								<Combobox.Input
									class="input w-full bg-white text-sm placeholder:text-surface-400 focus:outline-none"
								/>
							</Combobox.Control>
							<Combobox.Positioner>
								<Combobox.Content
									class="z-50 max-h-48 overflow-auto rounded-container border border-surface-200 bg-white shadow-lg"
								>
									{#each filteredLblItems as lbl (lbl.id)}
										<Combobox.Item
											item={lbl}
											class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-100 data-highlighted:bg-surface-100"
										>
											<Combobox.ItemIndicator>
												<svg
													class="h-3.5 w-3.5 text-primary-600"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
													stroke-width="2.5"
													><path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M5 13l4 4L19 7"
													/></svg
												>
											</Combobox.ItemIndicator>
											<Combobox.ItemText>
												<span
													class="rounded-base px-2 py-0.5 text-xs"
													style="background-color: {lbl.bg}; color: {lbl.txt};">{lbl.name}</span
												>
											</Combobox.ItemText>
										</Combobox.Item>
									{/each}
									{#if filteredLblItems.length === 0}
										<div class="px-3 py-2 text-sm text-surface-400">No labels found</div>
									{/if}
								</Combobox.Content>
							</Combobox.Positioner>
						</Combobox>
					</div>

					<label class="label min-w-40 flex-1">
						<span class="label-text text-xs">Follow-up Urgency</span>
						<select class="select text-sm" bind:value={followUpUrgency}>
							<option value="all">All urgency</option>
							<option value="overdue">Overdue</option>
							<option value="today">Due Today</option>
							<option value="this_week">Due This Week</option>
							<option value="upcoming">Upcoming (&gt;7d)</option>
							<option value="none">No Date Set</option>
						</select>
					</label>
				</div>

				<!-- More filters toggle -->
				<button
					type="button"
					class="-ml-1 btn btn-sm text-surface-500 hover:preset-tonal"
					onclick={() => (showMoreFilters = !showMoreFilters)}
				>
					{#if showMoreFilters}
						<svg
							class="h-3 w-3"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
							><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg
						>
						Fewer filters
					{:else}
						<svg
							class="h-3 w-3"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
							><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg
						>
						More filters
					{/if}
				</button>

				{#if showMoreFilters}
					<div
						class="grid grid-cols-2 gap-3 rounded-base border border-surface-100 bg-surface-50 p-3 sm:grid-cols-4"
					>
						<div class="flex flex-col gap-1">
							<span class="text-xs font-medium text-surface-600">Service Date From</span>
							<input type="date" bind:value={serviceDateStart} class="input text-xs" />
						</div>
						<div class="flex flex-col gap-1">
							<span class="text-xs font-medium text-surface-600">Service Date To</span>
							<input type="date" bind:value={serviceDateEnd} class="input text-xs" />
						</div>
						<div class="flex flex-col gap-1">
							<span class="text-xs font-medium text-surface-600">Billed Min ($)</span>
							<input
								type="number"
								bind:value={billedMin}
								placeholder="0.00"
								min="0"
								step="0.01"
								class="input text-xs"
							/>
						</div>
						<div class="flex flex-col gap-1">
							<span class="text-xs font-medium text-surface-600">Billed Max ($)</span>
							<input
								type="number"
								bind:value={billedMax}
								placeholder="no limit"
								min="0"
								step="0.01"
								class="input text-xs"
							/>
						</div>
						<div class="flex flex-col gap-1">
							<span class="text-xs font-medium text-surface-600">Follow-up From</span>
							<input type="date" bind:value={followUpStart} class="input text-xs" />
						</div>
						<div class="flex flex-col gap-1">
							<span class="text-xs font-medium text-surface-600">Follow-up To</span>
							<input type="date" bind:value={followUpEnd} class="input text-xs" />
						</div>
						<div class="flex flex-col gap-1">
							<span class="text-xs font-medium text-surface-600">Note Date From</span>
							<input type="date" bind:value={noteStart} class="input text-xs" />
						</div>
						<div class="flex flex-col gap-1">
							<span class="text-xs font-medium text-surface-600">Note Date To</span>
							<input type="date" bind:value={noteEnd} class="input text-xs" />
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Preset + Column picker bar -->
		<div
			class="flex flex-wrap items-center gap-2 {showFilters
				? 'border-t border-surface-100 pt-3'
				: ''}"
		>
			<span class="text-xs font-semibold tracking-wide text-surface-500 uppercase">Preset:</span>
			{#each Object.entries(PRESETS) as [key, preset] (key)}
				<button
					onclick={() => applyPreset(key as Preset)}
					class="btn btn-sm {activePreset === key ? 'preset-tonal-primary' : 'hover:preset-tonal'}">{preset.label}</button
				>
			{/each}
			<Popover>
				<Popover.Trigger class="ml-1 btn preset-tonal btn-sm">
					Columns ({visibleCols.length})
					<svg
						class="ml-1 h-3 w-3 shrink-0"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
						><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg
					>
				</Popover.Trigger>
				<Popover.Positioner class="z-50">
					<Popover.Content
						class="w-48 rounded-container border border-surface-200 bg-white py-2 shadow-lg"
					>
						{#each ALL_COLS as col (col.key)}
							<label
								class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-50"
							>
								<input
									type="checkbox"
									checked={visibleCols.includes(col.key)}
									onchange={() => toggleCol(col.key)}
									class="rounded-base"
								/>
								{col.label}
							</label>
						{/each}
					</Popover.Content>
				</Popover.Positioner>
			</Popover>
		</div>

		<!-- Active filter chips -->
		{#if hasActiveFilters}
			<div class="flex flex-wrap gap-1.5">
				{#each activeFilterChips as chip (chip.key)}
					<span class="badge flex items-center gap-0.5 preset-tonal-primary text-xs">
						{chip.label}
						<button
							type="button"
							onclick={chip.clear}
							class="ml-0.5 rounded-full px-0.5 hover:bg-primary-200 focus:outline-none"
							aria-label="Remove filter">&times;</button
						>
					</span>
				{/each}
			</div>
		{/if}
	</div>

	<!-- â”€â”€ Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
	<div class="table-wrap">
		<table class="table caption-bottom">
			<thead class="sticky top-0 z-10 bg-white">
				<tr class="border-b border-surface-200">
					{#if visibleCols.includes('patient')}
						<th
							aria-sort={sortAriaSort('patient')}
							class="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-surface-600 uppercase"
						>
							<button class="sort-btn" onclick={() => toggleSort('patient')}>
								Patient{#if sortKey === 'patient'}
									<span class="text-primary-500">{sortIndicator('patient')}</span>{/if}
							</button>
						</th>
					{/if}
					{#if visibleCols.includes('service_date')}
						<th
							aria-sort={sortAriaSort('service_date')}
							class="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-surface-600 uppercase"
						>
							<button class="sort-btn" onclick={() => toggleSort('service_date')}>
								Service Date{#if sortKey === 'service_date'}
									<span class="text-primary-500">{sortIndicator('service_date')}</span>{/if}
							</button>
						</th>
					{/if}
					{#if visibleCols.includes('follow_up_date')}
						<th
							aria-sort={sortAriaSort('follow_up_date')}
							class="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-surface-600 uppercase"
						>
							<button class="sort-btn" onclick={() => toggleSort('follow_up_date')}>
								Follow-up{#if sortKey === 'follow_up_date'}
									<span class="text-primary-500">{sortIndicator('follow_up_date')}</span>{/if}
							</button>
						</th>
					{/if}
					{#if visibleCols.includes('billed')}
						<th
							aria-sort={sortAriaSort('billed')}
							class="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-surface-600 uppercase"
						>
							<button class="sort-btn" onclick={() => toggleSort('billed')}>
								Billed{#if sortKey === 'billed'}
									<span class="text-primary-500">{sortIndicator('billed')}</span>{/if}
							</button>
						</th>
					{/if}
					{#if visibleCols.includes('insurances')}
						<th
							aria-sort={sortAriaSort('insurances')}
							class="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-surface-600 uppercase"
						>
							<button class="sort-btn" onclick={() => toggleSort('insurances')}>
								Insurance{#if sortKey === 'insurances'}
									<span class="text-primary-500">{sortIndicator('insurances')}</span>{/if}
							</button>
						</th>
					{/if}
					{#if visibleCols.includes('labels')}
						<th
							aria-sort={sortAriaSort('labels')}
							class="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-surface-600 uppercase"
						>
							<button class="sort-btn" onclick={() => toggleSort('labels')}>
								Labels{#if sortKey === 'labels'}
									<span class="text-primary-500">{sortIndicator('labels')}</span>{/if}
							</button>
						</th>
					{/if}
					{#if visibleCols.includes('last_note')}
						<th
							aria-sort={sortAriaSort('last_note')}
							class="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-surface-600 uppercase"
						>
							<button class="sort-btn" onclick={() => toggleSort('last_note')}>
								Last Note{#if sortKey === 'last_note'}
									<span class="text-primary-500">{sortIndicator('last_note')}</span>{/if}
							</button>
						</th>
					{/if}
					{#if visibleCols.includes('status')}
						<th
							aria-sort={sortAriaSort('status')}
							class="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-surface-600 uppercase"
						>
							<button class="sort-btn" onclick={() => toggleSort('status')}>
								Status{#if sortKey === 'status'}
									<span class="text-primary-500">{sortIndicator('status')}</span>{/if}
							</button>
						</th>
					{/if}
				</tr>
			</thead>
			<tbody class="[&>tr]:hover:preset-tonal-primary">
				{#each sortedRows as row (row.id)}
					<tr class="border-b border-surface-100 align-top">
						{#if visibleCols.includes('patient')}
							<td class="px-3 py-2.5">
								{#if row.patient}
									<a
										href="/record/{row.patient.id}"
										class="font-medium text-primary-700 hover:underline"
									>
										{row.patient.last_name}, {row.patient.first_name}
									</a>
									<span class="block text-xs text-surface-400"
										>{formatDate(row.patient.date_of_birth)}</span
									>
								{/if}
							</td>
						{/if}
						{#if visibleCols.includes('service_date')}
							<td class="px-3 py-2.5 text-sm whitespace-nowrap"
								>{formatDate(row.service_start_date)}</td
							>
						{/if}
						{#if visibleCols.includes('follow_up_date')}
							<td class="px-3 py-2.5 whitespace-nowrap">
								{#if row.follow_up_date}
									{@const badge = followUpBadge(row.follow_up_date)}
									<div class="flex flex-col gap-0.5">
										<span class="text-sm">{formatDate(row.follow_up_date)}</span>
										{#if badge}
											<span class="{badge.cls} w-fit text-xs">{badge.label}</span>
										{/if}
									</div>
								{/if}
							</td>
						{/if}
						{#if visibleCols.includes('billed')}
							<td class="px-3 py-2.5 text-right text-sm whitespace-nowrap tabular-nums"
								>{formatCurrency(row.billed_amount)}</td
							>
						{/if}
						{#if visibleCols.includes('insurances')}
							<td class="px-3 py-2.5 text-sm">
								{#if row.insurances.length}
									{row.insurances.map((i) => i.name).join(', ')}
								{/if}
							</td>
						{/if}
						{#if visibleCols.includes('labels')}
							<td class="px-3 py-2.5">
								{#if row.labels.length}
									<div class="flex flex-wrap gap-1">
										{#each row.labels as lbl}
											<span
												class="rounded-base px-2 py-0.5 text-xs"
												style="background-color: {lbl.bg_color}; color: {lbl.txt_color};"
												>{lbl.label_name}</span
											>
										{/each}
									</div>
								{/if}
							</td>
						{/if}
						{#if visibleCols.includes('last_note')}
							<td class="max-w-xs px-3 py-2.5">
								{#if row.last_note}
									<p class="line-clamp-2 text-xs text-surface-700">
										<span class="whitespace-nowrap text-surface-400"
											>{formatNoteTimestamp(row.last_note.created_at)}</span
										>
										<span class="font-medium text-surface-600"
											>{row.last_note.username ?? 'unknown'}:</span
										>
										{row.last_note.note}
									</p>
								{/if}
							</td>
						{/if}
						{#if visibleCols.includes('status')}
							<td class="px-3 py-2.5 whitespace-nowrap">
								{#if row.is_closed}
									<span class="badge preset-tonal-surface text-xs">Closed</span>
								{:else}
									<span class="badge preset-tonal-success text-xs">Open</span>
								{/if}
							</td>
						{/if}
					</tr>
				{:else}
					<tr>
						<td colspan={colSpan}>
							<div
								class="rounded-container border-2 border-dashed border-surface-200 p-8 text-center"
							>
								<p class="text-sm text-surface-500">
									{#if data.reportData.length === 0 && data.dateMode === 'lastNote'}
										No denials with notes found in this date range.
									{:else if data.reportData.length === 0}
										No denials found in this date range.
									{:else}
										No records match the selected filters.
									{/if}
								</p>
							</div>
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
