<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';

	export let supabase: SupabaseClient;
	let selectedDay: number;
	let selectedMonthIndex: number;
	let selectedYear: number;
	let month_string: string;
	let daysInMonth: {
		date: number;
		month?: number;
		year?: number;
		month_type: string;
		status?: string;
	}[] = [];

	async function updateCalendar(year: number, monthIndex: number, day: number) {
		const firstDayOfMonth = new Date(year, monthIndex, 1).getDay();
		const lastDateOfMonth = new Date(year, monthIndex + 1, 0).getDate();
		const lastDayOfLastMonth = new Date(year, monthIndex, 0).getDate();

		const { data, error } = await supabase.storage
			.from('files')
			.list(`${year}/${String(monthIndex + 1).padStart(2, '0')}`, {
				limit: 100,
				offset: 0,
				sortBy: { column: 'name', order: 'asc' }
			});

		let status: Number[] = [];

		if (error) {
			status = [];
		} else {
			status = data.map((file) => {
				return Number(file.name);
			});
		}

		let dayStatusNew = [];
		let dayStatusInProgress = [];

		for (let i = 1; i <= lastDateOfMonth; i++) {
			if (status.includes(i)) {
				const folderPath = `${year}/${String(monthIndex + 1).padStart(2, '0')}/${String(i).padStart(2, '0')}`;

				const { data, error } = await supabase
					.from('files')
					.select('metadata->status')
					.like('name', `%${folderPath}%`)
					.order('created_at', { ascending: true });

				if (!error) {
					let validDates = data.map((file) => {
						return file.status;
					});

					if (validDates.includes('New')) {
						dayStatusNew.push(i);
					} else if (validDates.includes('In Progress')) {
						dayStatusInProgress.push(i);
					}
				}
			}
		}

		daysInMonth = [];

		// Fill in the days from the previous month
		for (let i = firstDayOfMonth; i > 0; i--) {
			daysInMonth.push({
				date: lastDayOfLastMonth - i + 1,
				month_type: 'prev'
			});
		}

		// Fill in the days of the current month
		for (let i = 1; i <= lastDateOfMonth; i++) {
			if (status.includes(i)) {
				if (dayStatusNew.includes(i)) {
					daysInMonth.push({
						date: i,
						month: monthIndex,
						year: year,
						month_type: 'current',
						status: 'new'
					});
				} else if (dayStatusInProgress.includes(i)) {
					daysInMonth.push({
						date: i,
						month: monthIndex,
						year: year,
						month_type: 'current',
						status: 'inprogress'
					});
				} else {
					daysInMonth.push({
						date: i,
						month: monthIndex,
						year: year,
						month_type: 'current',
						status: 'completed'
					});
				}
			} else {
				daysInMonth.push({
					date: i,
					month: monthIndex,
					year: year,
					month_type: 'current',
					status: 'empty'
				});
			}
		}

		// Fill in the days of the next month
		const remainingDays = 42 - daysInMonth.length;
		for (let i = 1; i <= remainingDays; i++) {
			daysInMonth.push({
				date: i,
				month_type: 'next'
			});
		}
	}

	function prevMonth() {
		selectedMonthIndex--;
		if (selectedMonthIndex == -1) {
			selectedMonthIndex = 11;
			selectedYear--;
		}
		updateCalendar(selectedYear, selectedMonthIndex, 1);
		month_string = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}`;
	}

	function nextMonth() {
		selectedMonthIndex++;
		if (selectedMonthIndex == 12) {
			selectedMonthIndex = 0;
			selectedYear++;
		}
		updateCalendar(selectedYear, selectedMonthIndex, 1);
		month_string = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}`;
	}

	function updateYearMonth(event) {
		const [year, month] = event.target.value.split('-');
		selectedYear = parseInt(year);
		selectedMonthIndex = parseInt(month) - 1;
		updateCalendar(parseInt(year), parseInt(month) - 1, 1);
	}

	onMount(() => {
		const date = new Date();
		selectedYear = date.getFullYear();
		selectedMonthIndex = date.getMonth();
		selectedDay = date.getDate();
		updateCalendar(selectedYear, selectedMonthIndex, selectedDay);
		month_string = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}`;
	});
</script>

<div class="flex flex-row gap-4">
	<div class="table-container w-fit border border-surface-300">
		<table class="table table-hover">
			<thead>
				<tr>
					<th class="text-left"><button type="button" on:click={prevMonth}>Prev</button></th>
					<th class="text-center">
						<input
							type="month"
							class="input"
							bind:value={month_string}
							on:change={updateYearMonth}
						/>
					</th>
					<th class="text-right"><button type="button" on:click={nextMonth}>Next</button></th>
				</tr>
			</thead>
		</table>
		<table class="table table-hover rounded-none">
			<thead>
				<tr class="bg-surface-400">
					<th class="text-center">S</th>
					<th class="text-center">M</th>
					<th class="text-center">T</th>
					<th class="text-center">W</th>
					<th class="text-center">T</th>
					<th class="text-center">F</th>
					<th class="text-center">S</th>
				</tr>
			</thead>
			<tbody>
				{#each Array(Math.ceil(daysInMonth.length / 7)) as _, weekIndex}
					<tr>
						{#each daysInMonth.slice(weekIndex * 7, weekIndex * 7 + 7) as day}
							{#if day.month_type === 'prev'}
								<td class="text-center text-gray-400">
									<span>{day.date}</span>
								</td>
							{:else if day.month_type === 'next'}
								<td class="text-center text-gray-400">
									<span>{day.date}</span>
								</td>
							{:else if day.month_type === 'current' && day.status == 'empty'}
								<td class="text-center">
									<span>{day.date}</span>
								</td>
							{:else if day.month_type === 'current' && day.status == 'new'}
								<td class="variant-filled-error text-center">
									<form method="POST" action="?/getFileList" use:enhance>
										<input
											type="hidden"
											name="date"
											value={month_string + '-' + String(day.date).padStart(2, '0')}
										/>
										<button>{day.date}</button>
									</form>
								</td>
							{:else if day.month_type === 'current' && day.status == 'inprogress'}
								<td class="variant-filled-warning text-center">
									<form method="POST" action="?/getFileList" use:enhance>
										<input
											type="hidden"
											name="date"
											value={month_string + '-' + String(day.date).padStart(2, '0')}
										/>
										<button>{day.date}</button>
									</form>
								</td>
							{:else if day.month_type === 'current' && day.status == 'completed'}
								<td class="variant-filled-primary text-center text-on-primary-token">
									<form method="POST" action="?/getFileList" use:enhance>
										<input
											type="hidden"
											name="date"
											value={month_string + '-' + String(day.date).padStart(2, '0')}
										/>
										<button>{day.date}</button>
									</form>
								</td>
							{:else}
								<td class="text-center">
									<span>{day.date}</span>
								</td>
							{/if}
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="table-container h-fit w-fit border border-surface-300">
		<table class="table">
			<tbody>
				<tr>
					<td class="variant-filled-error">New</td>
				</tr>
				<tr>
					<td class="variant-filled-warning">In Progress</td>
				</tr>
				<tr>
					<td class="variant-filled-primary">Completed</td>
				</tr>
			</tbody>
		</table>
	</div>
</div>
