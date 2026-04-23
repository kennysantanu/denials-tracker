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

	const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
	const pdfExtensions = ['.pdf'];

	function getExt(name: string): string {
		const dot = name.lastIndexOf('.');
		return dot >= 0 ? name.slice(dot).toLowerCase() : '';
	}

	let previewFile = $state<{ name: string; url: string; ext: string } | null>(null);
	let previewLoading = $state(false);
	let previewError = $state('');

	async function openPreview(name: string) {
		previewLoading = true;
		previewError = '';
		previewFile = null;
		try {
			const res = await fetch(`/api/file-preview?name=${encodeURIComponent(name)}`);
			if (!res.ok) throw new Error('Failed to load preview');
			const { signedUrl } = await res.json();
			previewFile = { name, url: signedUrl, ext: getExt(name) };
		} catch {
			previewError = 'Could not load file preview.';
		} finally {
			previewLoading = false;
		}
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
										<div class="flex items-center gap-2">
											<a
												href="/file/view?name={encodeURIComponent(file.name)}"
												class="text-primary-600 underline-offset-2 hover:underline"
											>
												{file.name}
											</a>
											<button
												type="button"
												title="Preview"
												onclick={() => openPreview(file.name)}
												class="shrink-0 rounded p-0.5 text-surface-400 hover:bg-surface-100 hover:text-surface-700"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													class="h-4 w-4"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
													stroke-width="2"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
													/>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
													/>
												</svg>
											</button>
										</div>
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

<!-- Preview Dialog -->
{#if previewLoading || previewError || previewFile}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		role="dialog"
		aria-modal="true"
		aria-label="File preview"
		tabindex="-1"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) {
				previewFile = null;
				previewError = '';
			}
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') {
				previewFile = null;
				previewError = '';
			}
		}}
	>
		<div
			class="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
		>
			<!-- Dialog header -->
			<div class="flex items-center justify-between border-b border-surface-200 px-4 py-3">
				<span class="truncate text-sm font-medium text-surface-800">
					{previewFile?.name ?? 'Loading…'}
				</span>
				<div class="flex items-center gap-2">
					{#if previewFile}
						<a
							href="/file/view?name={encodeURIComponent(previewFile.name)}"
							class="rounded-md border border-surface-300 px-3 py-1.5 text-xs font-medium text-surface-700 hover:bg-surface-50"
						>
							Open Full View
						</a>
					{/if}
					<button
						type="button"
						aria-label="Close preview"
						onclick={() => {
							previewFile = null;
							previewError = '';
						}}
						class="rounded p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-700"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>
			<!-- Dialog body -->
			<div class="flex-1 overflow-auto">
				{#if previewLoading}
					<div class="flex h-64 items-center justify-center text-surface-500">Loading preview…</div>
				{:else if previewError}
					<div class="flex h-64 items-center justify-center text-error-600">
						{previewError}
					</div>
				{:else if previewFile}
					{#if imageExtensions.includes(previewFile.ext)}
						<img
							src={previewFile.url}
							alt={previewFile.name}
							class="max-h-[75vh] w-full object-contain"
						/>
					{:else if pdfExtensions.includes(previewFile.ext)}
						<iframe src={previewFile.url} title={previewFile.name} class="h-[75vh] w-full"></iframe>
					{:else}
						<div class="flex h-64 flex-col items-center justify-center gap-4 text-surface-600">
							<p>Preview not available for this file type.</p>
							<a
								href={previewFile.url}
								download={previewFile.name}
								class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
							>
								Download File
							</a>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}
