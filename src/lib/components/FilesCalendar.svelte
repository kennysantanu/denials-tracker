<script lang="ts">
	import type { DateStatus } from '$lib/server/db/files';

	interface Props {
		/** Currently selected date string (YYYY-MM-DD) */
		selectedDate: string;
		/** Map of date strings to status: 'new' | 'in-progress' | 'completed' */
		dateStatuses: Record<string, DateStatus>;
		/** Called when the user clicks a day cell */
		onselect: (date: string) => void;
		/** Called when the user navigates to a different month */
		onmonthchange?: (year: number, month: number) => void;
	}

	let { selectedDate, dateStatuses, onselect, onmonthchange }: Props = $props();

	const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

	/** Status → background color class mapping */
	const STATUS_COLORS: Record<DateStatus, { bg: string; text: string; selectedRing: string }> = {
		new: { bg: 'bg-red-100', text: 'text-red-900', selectedRing: 'ring-red-400' },
		'in-progress': { bg: 'bg-amber-100', text: 'text-amber-900', selectedRing: 'ring-amber-400' },
		completed: { bg: 'bg-blue-100', text: 'text-blue-900', selectedRing: 'ring-blue-400' }
	};

	let viewYear = $state(0);
	let viewMonth = $state(0); // 1-indexed

	// Sync view when selectedDate prop changes
	$effect(() => {
		viewYear = parseInt(selectedDate.split('-')[0]);
		viewMonth = parseInt(selectedDate.split('-')[1]);
	});

	let todayStr = $derived(new Date().toISOString().split('T')[0]);

	let monthLabel = $derived(
		new Date(viewYear, viewMonth - 1).toLocaleDateString('en-US', {
			month: 'long',
			year: 'numeric'
		})
	);

	/** Returns an array of week arrays. Each week is 7 cells, null for empty slots. */
	let calendarGrid = $derived.by(() => {
		const firstDay = new Date(viewYear, viewMonth - 1, 1);
		const lastDay = new Date(viewYear, viewMonth, 0).getDate();
		const startDow = firstDay.getDay(); // 0=Sun

		const weeks: (number | null)[][] = [];
		let currentWeek: (number | null)[] = [];

		// Leading empty cells
		for (let i = 0; i < startDow; i++) {
			currentWeek.push(null);
		}

		for (let day = 1; day <= lastDay; day++) {
			currentWeek.push(day);
			if (currentWeek.length === 7) {
				weeks.push(currentWeek);
				currentWeek = [];
			}
		}

		// Trailing empty cells
		if (currentWeek.length > 0) {
			while (currentWeek.length < 7) {
				currentWeek.push(null);
			}
			weeks.push(currentWeek);
		}

		return weeks;
	});

	function dateStr(day: number): string {
		return `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	}

	function prevMonth() {
		if (viewMonth === 1) {
			viewMonth = 12;
			viewYear--;
		} else {
			viewMonth--;
		}
		onmonthchange?.(viewYear, viewMonth);
	}

	function nextMonth() {
		if (viewMonth === 12) {
			viewMonth = 1;
			viewYear++;
		} else {
			viewMonth++;
		}
		onmonthchange?.(viewYear, viewMonth);
	}

	function goToToday() {
		const now = new Date();
		viewYear = now.getFullYear();
		viewMonth = now.getMonth() + 1;
		onmonthchange?.(viewYear, viewMonth);
		onselect(todayStr);
	}

	function handleDayClick(day: number) {
		onselect(dateStr(day));
	}
</script>

<div class="rounded-lg border border-surface-200 bg-white">
	<!-- Header: Month navigation -->
	<div class="flex items-center justify-between border-b border-surface-200 px-4 py-3">
		<button
			type="button"
			class="rounded p-1.5 text-surface-600 transition-colors hover:bg-surface-100 hover:text-surface-900"
			onclick={prevMonth}
			aria-label="Previous month"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
		</button>

		<div class="flex items-center gap-3">
			<h2 class="text-sm font-semibold text-surface-900">{monthLabel}</h2>
			<button
				type="button"
				class="rounded px-2 py-0.5 text-xs text-primary-600 transition-colors hover:bg-primary-50"
				onclick={goToToday}
			>
				Today
			</button>
		</div>

		<button
			type="button"
			class="rounded p-1.5 text-surface-600 transition-colors hover:bg-surface-100 hover:text-surface-900"
			onclick={nextMonth}
			aria-label="Next month"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
			</svg>
		</button>
	</div>

	<!-- Weekday headers -->
	<div class="grid grid-cols-7 border-b border-surface-100">
		{#each WEEKDAYS as day (day)}
			<div class="py-2 text-center text-xs font-medium text-surface-500">{day}</div>
		{/each}
	</div>

	<!-- Calendar grid -->
	<div class="p-1">
		{#each calendarGrid as week, weekIdx (weekIdx)}
			<div class="grid grid-cols-7">
				{#each week as day, dayIdx (dayIdx)}
					{@const ds = day ? dateStr(day) : ''}
					{@const status = day ? dateStatuses[ds] : undefined}
					{@const isSelected = ds === selectedDate}
					{@const isToday = ds === todayStr}
					{@const colors = status ? STATUS_COLORS[status] : undefined}

					<div
						class="relative flex aspect-square items-center justify-center p-0.5"
						role="gridcell"
					>
						{#if day}
							<button
								type="button"
								class="flex h-full w-full items-center justify-center rounded-lg text-sm font-medium transition-colors
									{isSelected
									? colors
										? `${colors.bg} ${colors.text} ring-2 ring-inset ${colors.selectedRing} font-bold`
										: 'bg-primary-600 font-semibold text-white'
									: colors
										? `${colors.bg} ${colors.text} hover:opacity-80`
										: isToday
											? 'bg-primary-50 font-medium text-primary-700 ring-1 ring-primary-300 ring-inset'
											: 'text-surface-400 hover:bg-surface-50'}"
								onclick={() => handleDayClick(day)}
								aria-label="{day} {monthLabel}{status ? `, ${status}` : ''}"
							>
								{day}
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>
</div>
