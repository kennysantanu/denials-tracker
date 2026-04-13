<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatDate } from '$lib/utils';
	import FilesCalendar from '$lib/components/FilesCalendar.svelte';

	let { data } = $props();

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
	}

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
								<th class="px-4 py-3 font-medium text-surface-700">Name</th>
								<th class="px-4 py-3 font-medium text-surface-700">Size</th>
								<th class="px-4 py-3 font-medium text-surface-700">Status</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-surface-100">
							{#each data.files as file (file.name)}
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
										{formatBytes(file.size ?? 0)}
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
