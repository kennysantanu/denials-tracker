<svelte:head>
	<title>Files — Denials Tracker</title>
</svelte:head>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatDate } from '$lib/utils';

	let { data } = $props();

	let selectedDate = $state(data.selectedDate);

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
	}

	function handleDateChange() {
		goto(`/file?date=${selectedDate}`);
	}
</script>

<div class="mx-auto max-w-4xl space-y-6 p-6">
	<h1 class="text-2xl font-bold text-surface-900">Files</h1>

	<div class="flex items-center gap-4">
		<label for="date-picker" class="text-sm font-medium text-surface-700">Date</label>
		<input
			id="date-picker"
			type="date"
			bind:value={selectedDate}
			onchange={handleDateChange}
			class="rounded-md border border-surface-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
		/>
	</div>

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
						<th class="px-4 py-3 font-medium text-surface-700">Created At</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-surface-100">
					{#each data.files as file}
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
							<td class="px-4 py-3 text-surface-600">
								{formatDate(file.created_at)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
