<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { formatDate } from '$lib/utils';
	import { toastSuccess, toastError } from '$lib/toast';
	import type { Database } from '$lib/supabase';

	type FileMetadata = { status?: string; note?: string };
	type FilesRow = Database['public']['Tables']['files']['Row'];

	interface Props {
		fileName: string;
		fileRecord: FilesRow;
		canEdit: boolean;
		canDelete: boolean;
	}

	let { fileName, fileRecord, canEdit, canDelete }: Props = $props();

	const fileStatusOptions = ['New', 'In Progress', 'Completed'];

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
	}

	function getMeta(): FileMetadata {
		const m = fileRecord.metadata;
		if (m && typeof m === 'object' && !Array.isArray(m)) return m as FileMetadata;
		return {};
	}

	const meta = $derived(getMeta());
	const fileStatus = $derived(meta.status ?? 'New');

	let editFileInfo = $state(false);
	let editStatus = $state('New');
	let editNote = $state('');
	let confirmDelete = $state(false);
	let isDeleting = $state(false);

	$effect(() => {
		editStatus = meta.status ?? 'New';
		editNote = meta.note ?? '';
	});
</script>

<div class="@container card border border-surface-200 bg-white">
	<form
		method="POST"
		action="?/updateFileInfo"
		use:enhance={({ submitter }) => {
			const deletingNow = submitter?.getAttribute('formaction')?.includes('deleteFile') ?? false;
			if (deletingNow) isDeleting = true;
			return async ({ result }) => {
				if (result.type === 'redirect') {
					toastSuccess('File deleted');
					await goto(result.location);
				} else if (result.type === 'success') {
					toastSuccess('File info updated');
					editFileInfo = false;
					await invalidateAll();
				} else {
					toastError(deletingNow ? 'Failed to delete file' : 'Failed to update file info');
					if (deletingNow) {
						isDeleting = false;
						confirmDelete = false;
					}
				}
			};
		}}
	>
		<input type="hidden" name="name" value={fileName} />
		<div class="space-y-2 px-4 py-3">
			{#if editFileInfo}
				<!-- Edit Mode -->
				<h2 class="text-sm font-semibold text-surface-600">File Info</h2>
				<dl class="space-y-1.5 text-sm">
					<div class="flex items-center justify-between gap-2">
						<dt class="shrink-0 text-xs font-medium text-surface-500">File Path</dt>
						<dd class="truncate text-right text-surface-800" title={fileName}>{fileName}</dd>
					</div>
					<div class="flex items-center justify-between gap-2">
						<dt class="shrink-0 text-xs font-medium text-surface-500">Uploaded</dt>
						<dd class="text-right text-surface-800">{formatDate(fileRecord.created_at)}</dd>
					</div>
					<div class="flex items-center justify-between gap-2">
						<dt class="shrink-0 text-xs font-medium text-surface-500">Size</dt>
						<dd class="text-right text-surface-800">{formatBytes(fileRecord.size ?? 0)}</dd>
					</div>
				</dl>
				<div>
					<label for="status-select" class="text-xs font-medium text-surface-500">Status</label>
					<select id="status-select" name="status" bind:value={editStatus} class="select mt-1">
						{#each fileStatusOptions as option (option)}
							<option value={option}>{option}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="note-input" class="text-xs font-medium text-surface-500">Note</label>
					<textarea id="note-input" name="note" rows="2" bind:value={editNote} class="mt-1 textarea"
					></textarea>
				</div>
				<div class="flex flex-col gap-3 @sm:flex-row @sm:items-center @sm:justify-between">
					<div class="flex gap-2">
						<button type="submit" class="btn preset-filled-primary-500"> Save </button>
						<button
							type="button"
							class="btn preset-outlined-surface-500"
							onclick={() => {
								editFileInfo = false;
								editStatus = meta.status ?? 'New';
								editNote = meta.note ?? '';
							}}
						>
							Cancel
						</button>
					</div>
					{#if canDelete}
						{#if confirmDelete}
							<div class="flex flex-col items-start gap-2 @sm:flex-row @sm:items-center">
								<span class="text-sm text-error-700">Delete this file permanently?</span>
								<div class="flex gap-2">
									<button
										type="submit"
										formaction="?/deleteFile"
										disabled={isDeleting}
										class="btn preset-filled-error-500"
									>
										{isDeleting ? 'Deleting…' : 'Yes, delete'}
									</button>
									<button
										type="button"
										disabled={isDeleting}
										class="btn preset-outlined-surface-500"
										onclick={() => (confirmDelete = false)}
									>
										Cancel
									</button>
								</div>
							</div>
						{:else}
							<button
								type="button"
								class="btn preset-filled-error-500"
								onclick={() => (confirmDelete = true)}
							>
								Delete
							</button>
						{/if}
					{/if}
				</div>
			{:else}
				<!-- View Mode: compact single-row summary -->
				<div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
					<span
						class="badge shrink-0 {fileStatus === 'Completed'
							? 'preset-tonal-success'
							: fileStatus === 'In Progress'
								? 'preset-tonal-warning'
								: 'preset-tonal-surface'}"
					>
						{fileStatus}
					</span>
					<span class="min-w-0 truncate text-surface-700" title={fileName}>{fileName}</span>
					<span class="shrink-0 text-surface-500">{formatDate(fileRecord.created_at)}</span>
					<span class="shrink-0 text-surface-500">{formatBytes(fileRecord.size ?? 0)}</span>
					<span class="shrink-0 text-surface-500">{fileRecord.mimetype ?? 'Unknown'}</span>
					{#if canEdit}
						<button
							type="button"
							class="ml-auto btn shrink-0 preset-outlined-primary-500 btn-sm"
							onclick={() => (editFileInfo = true)}
						>
							Edit
						</button>
					{/if}
				</div>
				{#if meta.note}
					<p class="truncate text-sm text-surface-700" title={meta.note}>
						<span class="text-xs font-medium text-surface-500">Note:</span>
						{meta.note}
					</p>
				{/if}
			{/if}
		</div>
	</form>
</div>
