<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatDate } from '$lib/utils';
	import FilesCalendar from '$lib/components/FilesCalendar.svelte';

	let { data } = $props();

	type SortKey = 'name' | 'type' | 'uploaded' | 'status';
	let sortKey = $state<SortKey>('name');
	let sortAsc = $state(true);

	function formatTime(iso: string | null): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function getType(name: string): string {
		const ext = name.split('.').pop();
		return ext ? ext.toUpperCase() : '—';
	}

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			sortAsc = !sortAsc;
		} else {
			sortKey = key;
			sortAsc = true;
		}
	}

	const sortedFiles = $derived(() => {
		return [...data.files].sort((a, b) => {
			let aVal = '';
			let bVal = '';
			if (sortKey === 'name') {
				aVal = a.name;
				bVal = b.name;
			} else if (sortKey === 'type') {
				aVal = getType(a.name);
				bVal = getType(b.name);
			} else if (sortKey === 'uploaded') {
				aVal = a.created_at ?? '';
				bVal = b.created_at ?? '';
			} else if (sortKey === 'status') {
				aVal = ((a.metadata as Record<string, unknown> | null)?.status as string) ?? 'New';
				bVal = ((b.metadata as Record<string, unknown> | null)?.status as string) ?? 'New';
			}
			const cmp = aVal.localeCompare(bVal);
			return sortAsc ? cmp : -cmp;
		});
	});

	function handleDateSelect(date: string) {
		goto(`/file?date=${date}`);
	}

	function handleMonthChange(year: number, month: number) {
		// Navigate to 1st of the new month to load that month's file dates
		const dateStr = `${year}-${String(month).padStart(2, '0')}-01`;
		goto(`/file?date=${dateStr}`);
	}
</script>

<svelte:head>
	<title>Files — Denials Tracker</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-6 p-6">
	<h1 class="text-2xl font-bold text-surface-900">Files</h1>

	<div class="flex flex-col gap-6 lg:flex-row">
		<!-- Calendar sidebar -->
		<div class="w-full shrink-0 lg:w-72">
			<FilesCalendar
				selectedDate={data.selectedDate}
				dateStatuses={data.dateStatuses}
				onselect={handleDateSelect}
				onmonthchange={handleMonthChange}
			/>
		</div>

		<!-- File list -->
		<div class="min-w-0 flex-1">
			<h2 class="mb-3 text-sm font-medium text-surface-600">
				{formatDate(data.selectedDate, {
					weekday: 'long',
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				})}
			</h2>

			{#if data.files.length === 0}
				<div class="rounded-md border border-surface-200 bg-surface-50 px-6 py-10 text-center">
					<p class="text-surface-500">No files found for this date.</p>
				</div>
			{:else}
				<div class="overflow-x-auto rounded-md border border-surface-200">
					<table class="w-full text-left text-sm">
						<thead class="border-b border-surface-200 bg-surface-50">
							<tr>
								{#each [['name', 'Name'], ['type', 'Type'], ['uploaded', 'Uploaded'], ['status', 'Status']] as [SortKey, string][] as [key, label]}
									<th class="px-4 py-3 font-medium text-surface-700">
										<button
											class="inline-flex items-center gap-1 hover:text-surface-900"
											onclick={() => toggleSort(key)}
										>
											{label}
											{#if sortKey === key}
												<span class="text-xs">{sortAsc ? '↑' : '↓'}</span>
											{:else}
												<span class="text-xs text-surface-400">↕</span>
											{/if}
										</button>
									</th>
								{/each}
							</tr>
						</thead>
						<tbody class="divide-y divide-surface-100">
							{#each sortedFiles() as file (file.name)}
								{@const status =
									((file.metadata as Record<string, unknown> | null)?.status as string) ?? 'New'}
								<tr class="hover:bg-surface-50">
									<td class="px-4 py-3">
										<a
											href="/file/view?name={encodeURIComponent(file.name)}"
											class="text-primary-600 underline-offset-2 hover:underline"
										>
											{file.name}
										</a>
									</td>
									<td class="px-4 py-3 text-surface-600">
										{getType(file.name)}
									</td>
									<td class="px-4 py-3 text-surface-600">
										{formatTime(file.created_at)}
									</td>
									<td class="px-4 py-3">
										<span
											class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
{status === 'New'
												? 'bg-red-100 text-red-800'
												: status === 'In Progress'
													? 'bg-amber-100 text-amber-800'
													: 'bg-blue-100 text-blue-800'}"
										>
											{status}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>
</div>
