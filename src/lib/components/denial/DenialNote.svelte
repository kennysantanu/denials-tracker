<script lang="ts">
	import type { Database } from '$lib/supabase';
	import type { DateStatus } from '$lib/server/db/files';
	import { enhance } from '$app/forms';
	import { toastSuccess, toastError } from '$lib/toast';
	import { invalidateAll } from '$app/navigation';
	import { formatDate } from '$lib/utils';
	import FilesCalendar from '$lib/components/FilesCalendar.svelte';

	type FileRow = Database['public']['Tables']['files']['Row'];

	type NoteRow = Database['public']['Tables']['notes']['Row'] & {
		created_by_user?: { username: string | null } | null;
		notes_files?: { file_name: string; files: FileRow | null }[];
	};

	interface Props {
		note: NoteRow;
		permissions: Record<string, boolean>;
		patientId: number;
	}

	let { note, permissions, patientId }: Props = $props();

	let menuOpen = $state(false);
	let editing = $state(false);
	let editText = $state('');

	// Edit mode: file management
	let filesToRemove = $state<string[]>([]);
	let showEditFilePicker = $state(false);
	let editCalendarDate = $state(new Date().toISOString().split('T')[0]);
	let editDateStatuses = $state<Record<string, DateStatus>>({});
	let editFilesForDate = $state<FileRow[]>([]);
	let editSelectedFiles = $state<FileRow[]>([]);
	let editLoadingFiles = $state(false);

	let attachedFiles = $derived(
		(note.notes_files ?? []).filter((nf) => nf.files).map((nf) => nf.files!)
	);

	let visibleAttachedFiles = $derived(attachedFiles.filter((f) => !filesToRemove.includes(f.name)));

	function toggleMenu() {
		menuOpen = !menuOpen;
	}

	function startEdit() {
		editText = note.note;
		filesToRemove = [];
		editSelectedFiles = [];
		showEditFilePicker = false;
		editing = true;
		menuOpen = false;
	}

	function cancelEdit() {
		editing = false;
		editText = note.note;
		filesToRemove = [];
		editSelectedFiles = [];
		showEditFilePicker = false;
	}

	async function loadEditFilesForDate(date: string) {
		editLoadingFiles = true;
		try {
			const res = await fetch(`/api/v1/files?date=${encodeURIComponent(date)}`);
			if (res.ok) {
				const data = await res.json();
				editFilesForDate = data.files ?? [];
				editDateStatuses = data.dateStatuses ?? {};
			} else {
				editFilesForDate = [];
			}
		} catch {
			editFilesForDate = [];
		}
		editLoadingFiles = false;
	}

	function handleEditCalendarSelect(date: string) {
		editCalendarDate = date;
		loadEditFilesForDate(date);
	}

	function handleEditMonthChange(year: number, month: number) {
		const dateStr = `${year}-${String(month).padStart(2, '0')}-01`;
		editCalendarDate = dateStr;
		loadEditFilesForDate(dateStr);
	}

	function toggleEditFile(file: FileRow) {
		if (editSelectedFiles.some((f) => f.name === file.name)) {
			editSelectedFiles = editSelectedFiles.filter((f) => f.name !== file.name);
		} else {
			editSelectedFiles = [...editSelectedFiles, file];
		}
	}

	function removeEditFile(name: string) {
		editSelectedFiles = editSelectedFiles.filter((f) => f.name !== name);
	}

	function markFileForRemoval(name: string) {
		filesToRemove = [...filesToRemove, name];
	}

	function unmarkFileForRemoval(name: string) {
		filesToRemove = filesToRemove.filter((n) => n !== name);
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

<div class="rounded border border-surface-200 bg-white p-3">
	{#if editing}
		<form
			method="POST"
			action="?/updateNote"
			class="space-y-3"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						toastSuccess('Note updated');
						editing = false;
						filesToRemove = [];
						editSelectedFiles = [];
						showEditFilePicker = false;
						await invalidateAll();
					} else if (result.type === 'failure') {
						toastError('Error', (result.data as Record<string, string>)?.error || 'Update failed');
						await update({ reset: false });
					} else if (result.type === 'error') {
						toastError('Something went wrong');
					}
				};
			}}
		>
			<input type="hidden" name="id" value={note.id} />

			{#each filesToRemove as fileName}
				<input type="hidden" name="remove_files" value={fileName} />
			{/each}
			{#each editSelectedFiles as file (file.name)}
				<input type="hidden" name="add_files" value={file.name} />
			{/each}

			<textarea name="note" class="textarea w-full" rows="3" required bind:value={editText}
			></textarea>

			<!-- Currently attached files (with remove option) -->
			{#if attachedFiles.length > 0}
				<div>
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

			<!-- Newly selected files to add -->
			{#if editSelectedFiles.length > 0}
				<div class="flex flex-wrap gap-1.5">
					{#each editSelectedFiles as file (file.name)}
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
								onclick={() => removeEditFile(file.name)}
								aria-label="Remove">✕</button
							>
						</span>
					{/each}
				</div>
			{/if}

			<!-- Attach existing files picker -->
			<div>
				<button
					type="button"
					class="text-sm text-primary-600 hover:text-primary-800 hover:underline"
					onclick={() => {
						showEditFilePicker = !showEditFilePicker;
						if (showEditFilePicker && editFilesForDate.length === 0) {
							loadEditFilesForDate(editCalendarDate);
						}
					}}
				>
					{showEditFilePicker ? '− Hide' : '+ Attach'} Existing Files
				</button>
			</div>

			{#if showEditFilePicker}
				<div class="rounded border border-surface-200 bg-surface-50 p-3">
					<div class="flex flex-col gap-3 sm:flex-row">
						<div class="w-full shrink-0 sm:w-56">
							<FilesCalendar
								selectedDate={editCalendarDate}
								dateStatuses={editDateStatuses}
								onselect={handleEditCalendarSelect}
								onmonthchange={handleEditMonthChange}
							/>
						</div>
						<div class="min-w-0 flex-1">
							<p class="mb-2 text-xs font-medium text-surface-600">Files for {editCalendarDate}</p>
							{#if editLoadingFiles}
								<p class="text-xs text-surface-500">Loading…</p>
							{:else if editFilesForDate.length === 0}
								<p class="text-xs text-surface-500">No files for this date.</p>
							{:else}
								<div class="max-h-48 space-y-1 overflow-y-auto">
									{#each editFilesForDate as file (file.name)}
										{@const alreadyAttached = attachedFiles.some((f) => f.name === file.name)}
										{@const isSelected = editSelectedFiles.some((f) => f.name === file.name)}
										<button
											type="button"
											class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors {isSelected
												? 'bg-primary-100 text-primary-800'
												: alreadyAttached
													? 'cursor-default bg-surface-100 text-surface-400'
													: 'hover:bg-surface-100'}"
											onclick={() => {
												if (!alreadyAttached) toggleEditFile(file);
											}}
											disabled={alreadyAttached}
										>
											<span class="shrink-0">
												{#if alreadyAttached}
													<svg
														class="h-4 w-4 text-surface-300"
														fill="currentColor"
														viewBox="0 0 20 20"
													>
														<path
															fill-rule="evenodd"
															d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
															clip-rule="evenodd"
														/>
													</svg>
												{:else if isSelected}
													<svg
														class="h-4 w-4 text-primary-600"
														fill="currentColor"
														viewBox="0 0 20 20"
													>
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
												<span class="shrink-0 text-xs text-surface-400"
													>{formatBytes(file.size)}</span
												>
											{/if}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/if}

			<div class="flex gap-2">
				<button type="submit" class="btn preset-filled-primary-500 btn-sm">Save</button>
				<button type="button" class="btn preset-outlined-surface-500 btn-sm" onclick={cancelEdit}>
					Cancel
				</button>
			</div>
		</form>
	{:else}
		<div class="flex items-start justify-between gap-2">
			<div class="flex-1">
				<p class="text-sm whitespace-pre-wrap text-surface-800">{note.note}</p>
				{#if attachedFiles.length > 0}
					<div class="mt-2 flex flex-wrap gap-2">
						{#each attachedFiles as file (file.name)}
							<a
								href="/file/view?name={encodeURIComponent(file.name)}"
								class="inline-flex items-center gap-1.5 rounded-md border border-surface-200 bg-surface-50 px-2.5 py-1 text-xs text-primary-600 transition-colors hover:bg-surface-100 hover:text-primary-800"
								title={file.name}
							>
								<svg
									class="h-3.5 w-3.5 shrink-0"
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
								<span class="max-w-[150px] truncate">{displayFileName(file.name)}</span>
								{#if file.size}
									<span class="text-surface-400">({formatBytes(file.size)})</span>
								{/if}
							</a>
						{/each}
					</div>
				{/if}
				<p class="mt-1 text-xs text-surface-500">
					{formatDate(note.created_at)}
					{#if note.created_by_user?.username}
						<span>by {note.created_by_user.username}</span>
					{:else if note.created_by}
						<span>by {note.created_by}</span>
					{/if}
				</p>
			</div>

			{#if permissions['update_denial'] || permissions['delete_denial']}
				<div class="relative">
					<button
						type="button"
						class="btn preset-outlined-surface-500 btn-sm px-1.5"
						title="Note actions"
						onclick={toggleMenu}
					>
						⋮
					</button>

					{#if menuOpen}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="absolute right-0 z-10 mt-1 min-w-32 rounded-lg border border-surface-200 bg-white py-1 shadow-lg"
							onmouseleave={() => (menuOpen = false)}
						>
							{#if permissions['update_denial']}
								<button
									type="button"
									class="w-full px-4 py-2 text-left text-sm hover:bg-surface-100"
									onclick={startEdit}
								>
									Edit
								</button>
							{/if}
							{#if permissions['delete_denial']}
								<form
									method="POST"
									action="?/deleteNote"
									use:enhance={() => {
										menuOpen = false;
										return async ({ result }) => {
											if (result.type === 'success') {
												toastSuccess('Note deleted');
												await invalidateAll();
											} else if (result.type === 'failure') {
												toastError(
													'Error',
													(result.data as Record<string, string>)?.error || 'Delete failed'
												);
											} else if (result.type === 'error') {
												toastError('Something went wrong');
											}
										};
									}}
								>
									<input type="hidden" name="id" value={note.id} />
									<button
										type="submit"
										class="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-surface-100"
									>
										Delete
									</button>
								</form>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
