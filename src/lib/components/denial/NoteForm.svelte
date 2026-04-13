<script lang="ts">
	import { enhance } from '$app/forms';
	import { toastSuccess, toastError } from '$lib/toast';
	import { goto, invalidateAll } from '$app/navigation';
	import type { Database } from '$lib/supabase';
	import type { DateStatus } from '$lib/server/db/files';
	import FilesCalendar from '$lib/components/FilesCalendar.svelte';

	type FileRow = Database['public']['Tables']['files']['Row'];

	interface Props {
		denialId: number;
		patientId: number;
		oncancel: () => void;
	}

	let { denialId, patientId, oncancel }: Props = $props();

	let showExistingPicker = $state(false);
	let calendarDate = $state(new Date().toISOString().split('T')[0]);
	let dateStatuses = $state<Record<string, DateStatus>>({});
	let filesForDate = $state<FileRow[]>([]);
	let selectedExistingFiles = $state<FileRow[]>([]);
	let loadingFiles = $state(false);

	async function loadFilesForDate(date: string) {
		loadingFiles = true;
		try {
			const res = await fetch(`/api/v1/files?date=${encodeURIComponent(date)}`);
			if (res.ok) {
				const data = await res.json();
				filesForDate = data.files ?? [];
				dateStatuses = data.dateStatuses ?? {};
			} else {
				filesForDate = [];
			}
		} catch {
			filesForDate = [];
		}
		loadingFiles = false;
	}

	function handleCalendarSelect(date: string) {
		calendarDate = date;
		loadFilesForDate(date);
	}

	function handleMonthChange(year: number, month: number) {
		const dateStr = `${year}-${String(month).padStart(2, '0')}-01`;
		calendarDate = dateStr;
		loadFilesForDate(dateStr);
	}

	function toggleExistingFile(file: FileRow) {
		if (selectedExistingFiles.some((f) => f.name === file.name)) {
			selectedExistingFiles = selectedExistingFiles.filter((f) => f.name !== file.name);
		} else {
			selectedExistingFiles = [...selectedExistingFiles, file];
		}
	}

	function removeExistingFile(name: string) {
		selectedExistingFiles = selectedExistingFiles.filter((f) => f.name !== name);
	}

	function displayFileName(name: string): string {
		const parts = name.split('/');
		const last = parts[parts.length - 1];
		const match = last.match(/^\d+_(.+)$/);
		return match ? match[1] : last;
	}

	function formatBytes(bytes: number | null): string {
		if (!bytes) return '';
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
	}
</script>

<form
	method="POST"
	action="?/createNote"
	enctype="multipart/form-data"
	class="space-y-3 rounded border border-surface-200 bg-white p-3"
	use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				toastSuccess('Note added');
				selectedExistingFiles = [];
				showExistingPicker = false;
				await invalidateAll();
				oncancel();
			} else if (result.type === 'failure') {
				toastError('Error', (result.data as Record<string, string>)?.error || 'Failed to add note');
				await update({ reset: false });
			} else if (result.type === 'redirect') {
				goto(result.location);
			} else if (result.type === 'error') {
				toastError('Something went wrong');
			}
		};
	}}
>
	<input type="hidden" name="denial_id" value={denialId} />

	{#each selectedExistingFiles as file (file.name)}
		<input type="hidden" name="existing_files" value={file.name} />
	{/each}

	<label class="label">
		<span class="label-text text-sm font-medium">Note</span>
		<textarea name="note" class="textarea" rows="3" required placeholder="Enter note..."></textarea>
	</label>

	<label class="label">
		<span class="label-text text-sm font-medium">Upload New Files (optional)</span>
		<input type="file" name="files" multiple class="input" />
	</label>

	<!-- Existing file picker toggle -->
	<div>
		<button
			type="button"
			class="text-sm text-primary-600 hover:text-primary-800 hover:underline"
			onclick={() => {
				showExistingPicker = !showExistingPicker;
				if (showExistingPicker && filesForDate.length === 0) {
					loadFilesForDate(calendarDate);
				}
			}}
		>
			{showExistingPicker ? '− Hide' : '+ Attach'} Existing Files
		</button>
	</div>

	{#if showExistingPicker}
		<div class="rounded border border-surface-200 bg-surface-50 p-3">
			<div class="flex flex-col gap-3 sm:flex-row">
				<!-- FilesCalendar -->
				<div class="w-full shrink-0 sm:w-56">
					<FilesCalendar
						selectedDate={calendarDate}
						{dateStatuses}
						onselect={handleCalendarSelect}
						onmonthchange={handleMonthChange}
					/>
				</div>

				<!-- File list for selected date -->
				<div class="min-w-0 flex-1">
					<p class="mb-2 text-xs font-medium text-surface-600">
						Files for {calendarDate}
					</p>
					{#if loadingFiles}
						<p class="text-xs text-surface-500">Loading…</p>
					{:else if filesForDate.length === 0}
						<p class="text-xs text-surface-500">No files for this date.</p>
					{:else}
						<div class="max-h-48 space-y-1 overflow-y-auto">
							{#each filesForDate as file (file.name)}
								{@const isSelected = selectedExistingFiles.some((f) => f.name === file.name)}
								<button
									type="button"
									class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors {isSelected
										? 'bg-primary-100 text-primary-800'
										: 'hover:bg-surface-100'}"
									onclick={() => toggleExistingFile(file)}
								>
									<span class="shrink-0">
										{#if isSelected}
											<svg class="h-4 w-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
												<path
													fill-rule="evenodd"
													d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
													clip-rule="evenodd"
												/>
											</svg>
										{:else}
											<svg
												class="h-4 w-4 text-surface-400"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
												/>
											</svg>
										{/if}
									</span>
									<span class="min-w-0 flex-1 truncate">{displayFileName(file.name)}</span>
									{#if file.size}
										<span class="shrink-0 text-xs text-surface-400">{formatBytes(file.size)}</span>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Selected existing files summary -->
	{#if selectedExistingFiles.length > 0}
		<div class="flex flex-wrap gap-1.5">
			{#each selectedExistingFiles as file (file.name)}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-1 text-xs text-primary-800"
				>
					<svg class="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
						/>
					</svg>
					{displayFileName(file.name)}
					<button
						type="button"
						class="ml-0.5 text-primary-600 hover:text-primary-900"
						onclick={() => removeExistingFile(file.name)}
						aria-label="Remove {displayFileName(file.name)}"
					>
						✕
					</button>
				</span>
			{/each}
		</div>
	{/if}

	<div class="flex gap-2">
		<button type="submit" class="btn preset-filled-primary-500 btn-sm">Submit</button>
		<button type="button" class="btn preset-outlined-surface-500 btn-sm" onclick={oncancel}>
			Cancel
		</button>
	</div>
</form>
