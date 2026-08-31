<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Database } from '$lib/supabase';
	import type { DateStatus } from '$lib/server/db/files';
	import FilesCalendar from '$lib/components/FilesCalendar.svelte';
	import type { Attachment } from 'svelte/attachments';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import X from '@lucide/svelte/icons/x';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import Check from '@lucide/svelte/icons/check';
	import Eye from '@lucide/svelte/icons/eye';
	import Plus from '@lucide/svelte/icons/plus';
	import Minus from '@lucide/svelte/icons/minus';

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
		/** Whether to show the "Attach Existing Files" picker (default: true) */
		allowExistingFiles?: boolean;
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
		addName = 'add_files',
		allowExistingFiles = true
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

	function getFileType(name: string): string {
		const ext = name.split('.').pop();
		return ext ? ext.toUpperCase() : '—';
	}

	function getFileStatus(file: FileRow): string {
		return ((file.metadata as Record<string, unknown> | null)?.status as string) ?? 'New';
	}

	const sortedFilesForDate = $derived(
		[...filesForDate].sort((a, b) => displayFileName(a.name).localeCompare(displayFileName(b.name)))
	);

	// Preview state
	const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
	const pdfExtensions = ['.pdf'];

	function getExt(fileName: string): string {
		const dot = fileName.lastIndexOf('.');
		return dot >= 0 ? fileName.slice(dot).toLowerCase() : '';
	}

	let previewFile = $state<{ name: string; url: string; ext: string } | null>(null);
	let previewLoading = $state(false);
	let previewError = $state('');

	async function openPreview(fileName: string) {
		previewLoading = true;
		previewError = '';
		previewFile = null;
		try {
			const res = await fetch(`/api/file-preview?name=${encodeURIComponent(fileName)}`);
			if (!res.ok) throw new Error('Failed to load preview');
			const json = await res.json();
			previewFile = { name: fileName, url: json.signedUrl, ext: getExt(fileName) };
		} catch {
			previewError = 'Could not load file preview.';
		} finally {
			previewLoading = false;
		}
	}

	function downloadPreviewFile() {
		if (!previewFile) return;
		window.location.href = previewFile.url;
	}

	/** Call this from the parent after a successful form submission to reset internal state */
	export function reset() {
		selectedExistingFiles = [];
		filesToRemove = [];
		showExistingPicker = false;
	}

	const autoresize: Attachment<HTMLTextAreaElement> = (node) => {
		function resize() {
			node.style.height = 'auto';
			node.style.height = node.scrollHeight + 'px';
		}
		node.addEventListener('input', resize);
		resize();
		return () => {
			node.removeEventListener('input', resize);
		};
	};
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
	<div class="mb-1 flex items-center justify-between">
		<label for="note-editor-{name}" class="block text-sm font-medium">
			Note {#if required}<span class="text-red-500">*</span>{/if}
		</label>
	</div>
	<textarea
		id="note-editor-{name}"
		{name}
		{required}
		rows="1"
		{placeholder}
		bind:value
		{@attach autoresize}
		class="w-full resize-none overflow-hidden rounded border border-surface-300 px-3 py-2 text-sm placeholder:text-surface-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none disabled:bg-surface-50 disabled:text-surface-400"
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
							class="ml-0.5 inline-flex items-center text-red-500 hover:text-red-800"
							onclick={() => unmarkFileForRemoval(file.name)}
							aria-label="Undo remove"><Undo2 class="h-3 w-3" /></button
						>
					{:else}
						<button
							type="button"
							class="ml-0.5 inline-flex items-center text-surface-400 hover:text-red-600"
							onclick={() => markFileForRemoval(file.name)}
							aria-label="Remove file"><X class="h-3 w-3" /></button
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
				<Paperclip class="h-3 w-3 shrink-0" />
				{displayFileName(file.name)}
				<button
					type="button"
					class="ml-0.5 inline-flex items-center text-primary-600 hover:text-primary-900"
					onclick={() => removeSelectedFile(file.name)}
					aria-label="Remove {displayFileName(file.name)}"><X class="h-3 w-3" /></button
				>
			</span>
		{/each}
	</div>
{/if}

<!-- Existing file picker toggle -->
{#if allowExistingFiles}
	<div class="mt-3">
		<button
			type="button"
			class="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800 hover:underline"
			onclick={() => {
				showExistingPicker = !showExistingPicker;
				if (showExistingPicker && filesForDate.length === 0) {
					loadFilesForDate(calendarDate);
				}
			}}
		>
			{#if showExistingPicker}
				<Minus class="h-4 w-4" />
				Hide
			{:else}
				<Plus class="h-4 w-4" />
				Attach
			{/if}
			Existing Files
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
						<div class="overflow-x-auto rounded border border-surface-200">
							<table class="w-full text-left text-xs">
								<thead class="border-b border-surface-200 bg-surface-100">
									<tr>
										<th class="px-2 py-2 font-medium text-surface-600">Name</th>
										<th class="px-2 py-2 font-medium text-surface-600">Type</th>
										<th class="px-2 py-2 font-medium text-surface-600">Status</th>
									</tr>
								</thead>
								<tbody class="max-h-48 divide-y divide-surface-100 overflow-y-auto">
									{#each sortedFilesForDate as file (file.name)}
										{@const alreadyAttached =
											isEditMode && attachedFiles.some((f) => f.name === file.name)}
										{@const isSelected = selectedExistingFiles.some((f) => f.name === file.name)}
										{@const fileStatus = getFileStatus(file)}
										<tr
											class="cursor-pointer transition-colors {isSelected
												? 'bg-primary-100'
												: alreadyAttached
													? 'cursor-default bg-surface-100 opacity-50'
													: 'hover:bg-surface-50'}"
											onclick={() => {
												if (!alreadyAttached) toggleExistingFile(file);
											}}
										>
											<td class="px-2 py-2">
												<div class="flex items-center gap-1.5">
												<span class="shrink-0">
													{#if alreadyAttached || isSelected}
														<Check
															class="h-3.5 w-3.5 {alreadyAttached
																? 'text-surface-400'
																: 'text-primary-600'}"
														/>
													{:else}
														<span class="block h-3.5 w-3.5"></span>
													{/if}
												</span>
													<span
														class="min-w-0 truncate {isSelected
															? 'font-medium text-primary-800'
															: 'text-surface-800'}"
													>
														{displayFileName(file.name)}
													</span>
													<button
														type="button"
														title="Preview"
														onclick={(e) => {
															e.stopPropagation();
															openPreview(file.name);
														}}
														class="shrink-0 rounded p-0.5 text-surface-400 hover:bg-surface-200 hover:text-surface-700"
													>
													<Eye class="h-3.5 w-3.5" />
													</button>
												</div>
											</td>
											<td class="px-2 py-2 text-surface-500">
												{getFileType(file.name)}
											</td>
											<td class="px-2 py-2">
												<span
													class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
														{fileStatus === 'New'
														? 'bg-red-100 text-red-800'
														: fileStatus === 'In Progress'
															? 'bg-amber-100 text-amber-800'
															: 'bg-blue-100 text-blue-800'}"
												>
													{fileStatus}
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
	{/if}
{/if}

<!-- Preview Dialog -->
{#if previewLoading || previewError || previewFile}
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
					{previewFile?.name ? displayFileName(previewFile.name) : 'Loading…'}
				</span>
				<div class="flex items-center gap-2">
					{#if previewFile}
						<a
							href={resolve(`/file/view?name=${encodeURIComponent(previewFile.name)}`)}
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
						<X class="h-5 w-5" />
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
							alt={displayFileName(previewFile.name)}
							class="max-h-[75vh] w-full object-contain"
						/>
					{:else if pdfExtensions.includes(previewFile.ext)}
						<iframe
							src={previewFile.url}
							title={displayFileName(previewFile.name)}
							class="h-[75vh] w-full"
						></iframe>
					{:else}
						<div class="flex h-64 flex-col items-center justify-center gap-4 text-surface-600">
							<p>Preview not available for this file type.</p>
							<button
								type="button"
								onclick={downloadPreviewFile}
								class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
							>
								Download File
							</button>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}
