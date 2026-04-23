<script lang="ts">
	import type { Database } from '$lib/supabase';
	import type { DateStatus } from '$lib/server/db/files';
	import FilesCalendar from '$lib/components/FilesCalendar.svelte';

	type FileRow = Database['public']['Tables']['files']['Row'];

	interface Props {
		/** Field name for the textarea (default: "note") */
		name?: string;
		/** Pre-filled text for edit mode */
		value?: string;
		/** Whether the textarea is required */
		required?: boolean;
		/** Textarea placeholder */
		placeholder?: string;
		/** Textarea rows (default: 3) */
		rows?: number;
		/** Already-attached files (edit mode) */
		attachedFiles?: FileRow[];
		/** Show the file upload input (default: true) */
		showUpload?: boolean;
		/** Field name for new file uploads (default: "files") */
		uploadName?: string;
		/** Field name for existing file hidden inputs (default: "existing_files") */
		existingName?: string;
		/** Field name for files to remove (edit mode, default: "remove_files") */
		removeName?: string;
		/** Field name for files to add (edit mode, default: "add_files") */
		addName?: string;
	}

	let {
		name = 'note',
		value = $bindable(''),
		required = false,
		placeholder = 'Enter note...',
		rows = 3,
		attachedFiles = [],
		showUpload = true,
		uploadName = 'files',
		existingName = 'existing_files',
		removeName = 'remove_files',
		addName = 'add_files'
	}: Props = $props();

	// File picker state
	let showExistingPicker = $state(false);
	let calendarDate = $state(new Date().toISOString().split('T')[0]);
	let dateStatuses = $state<Record<string, DateStatus>>({});
	let filesForDate = $state<FileRow[]>([]);
	let selectedExistingFiles = $state<FileRow[]>([]);
	let loadingFiles = $state(false);

	// Edit mode: files to remove from already-attached
	let filesToRemove = $state<string[]>([]);

	let isEditMode = $derived(attachedFiles.length > 0);

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

	function removeSelectedFile(fileName: string) {
		selectedExistingFiles = selectedExistingFiles.filter((f) => f.name !== fileName);
	}

	function markFileForRemoval(fileName: string) {
		filesToRemove = [...filesToRemove, fileName];
	}

	function unmarkFileForRemoval(fileName: string) {
		filesToRemove = filesToRemove.filter((n) => n !== fileName);
	}

	function displayFileName(fileName: string): string {
		const parts = fileName.split('/');
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

	/** Call this from the parent after a successful form submission to reset internal state */
	export function reset() {
		selectedExistingFiles = [];
		filesToRemove = [];
		showExistingPicker = false;
	}

	function autoresize(node: HTMLTextAreaElement) {
		function resize() {
			node.style.height = 'auto';
			node.style.height = node.scrollHeight + 'px';
		}
		node.addEventListener('input', resize);
		resize();
		return {
			destroy() {
				node.removeEventListener('input', resize);
			}
		};
	}
</script>

<!-- Hidden inputs for form submission -->
{#if isEditMode}
	{#each filesToRemove as fileName (fileName)}
		<input type="hidden" name={removeName} value={fileName} />
	{/each}
	{#each selectedExistingFiles as file (file.name)}
		<input type="hidden" name={addName} value={file.name} />
	{/each}
{:else}
	{#each selectedExistingFiles as file (file.name)}
		<input type="hidden" name={existingName} value={file.name} />
	{/each}
{/if}

<!-- Textarea -->
<div>
	<label for="note-editor-{name}" class="mb-1 block text-sm font-medium">
		Note {#if required}<span class="text-red-500">*</span>{/if}
	</label>
	<textarea
		id="note-editor-{name}"
		{name}
		{required}
		rows="1"
		{placeholder}
		bind:value
		use:autoresize
		class="w-full resize-none overflow-hidden rounded border border-surface-300 px-3 py-2 text-sm placeholder:text-surface-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
	></textarea>
</div>

<!-- Already-attached files (edit mode) -->
{#if isEditMode && attachedFiles.length > 0}
	<div class="mt-3">
		<p class="mb-1 text-xs font-medium text-surface-600">Attached files:</p>
		<div class="flex flex-wrap gap-1.5">
			{#each attachedFiles as file (file.name)}
				{@const isRemoved = filesToRemove.includes(file.name)}
				<span
					class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs {isRemoved
						? 'bg-red-100 text-red-600 line-through'
						: 'bg-surface-100 text-surface-700'}"
				>
					{displayFileName(file.name)}
					{#if isRemoved}
						<button
							type="button"
							class="ml-0.5 text-red-500 hover:text-red-800"
							onclick={() => unmarkFileForRemoval(file.name)}
							aria-label="Undo remove">↩</button
						>
					{:else}
						<button
							type="button"
							class="ml-0.5 text-surface-400 hover:text-red-600"
							onclick={() => markFileForRemoval(file.name)}
							aria-label="Remove file">✕</button
						>
					{/if}
				</span>
			{/each}
		</div>
	</div>
{/if}

<!-- New file upload -->
{#if showUpload}
	<div class="mt-3">
		<label for="note-editor-files" class="mb-1 block text-sm font-medium">
			Upload New Files (optional)
		</label>
		<input
			type="file"
			id="note-editor-files"
			name={uploadName}
			multiple
			class="w-full rounded border border-surface-300 px-3 py-2 text-sm"
		/>
	</div>
{/if}

<!-- Newly selected existing files summary (pills) -->
{#if selectedExistingFiles.length > 0}
	<div class="mt-2 flex flex-wrap gap-1.5">
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
					onclick={() => removeSelectedFile(file.name)}
					aria-label="Remove {displayFileName(file.name)}">✕</button
				>
			</span>
		{/each}
	</div>
{/if}

<!-- Existing file picker toggle -->
<div class="mt-3">
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
	<div class="mt-2 rounded border border-surface-200 bg-surface-50 p-3">
		<div class="flex flex-col gap-3 sm:flex-row">
			<div class="w-full shrink-0 sm:w-56">
				<FilesCalendar
					selectedDate={calendarDate}
					{dateStatuses}
					onselect={handleCalendarSelect}
					onmonthchange={handleMonthChange}
				/>
			</div>
			<div class="min-w-0 flex-1">
				<p class="mb-2 text-xs font-medium text-surface-600">Files for {calendarDate}</p>
				{#if loadingFiles}
					<p class="text-xs text-surface-500">Loading…</p>
				{:else if filesForDate.length === 0}
					<p class="text-xs text-surface-500">No files for this date.</p>
				{:else}
					<div class="max-h-48 space-y-1 overflow-y-auto">
						{#each filesForDate as file (file.name)}
							{@const alreadyAttached =
								isEditMode && attachedFiles.some((f) => f.name === file.name)}
							{@const isSelected = selectedExistingFiles.some((f) => f.name === file.name)}
							<button
								type="button"
								class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors {isSelected
									? 'bg-primary-100 text-primary-800'
									: alreadyAttached
										? 'cursor-default bg-surface-100 text-surface-400'
										: 'hover:bg-surface-100'}"
								onclick={() => {
									if (!alreadyAttached) toggleExistingFile(file);
								}}
								disabled={alreadyAttached}
							>
								<span class="shrink-0">
									{#if alreadyAttached}
										<svg class="h-4 w-4 text-surface-300" fill="currentColor" viewBox="0 0 20 20">
											<path
												fill-rule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clip-rule="evenodd"
											/>
										</svg>
									{:else if isSelected}
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
