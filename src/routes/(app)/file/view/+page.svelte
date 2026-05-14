<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { formatDate } from '$lib/utils';
	import { toastSuccess, toastError } from '$lib/toast';

	type FileMetadata = { status?: string; note?: string };

	let { data } = $props();

	const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
	const pdfExtensions = ['.pdf'];
	const fileStatusOptions = ['New', 'In Progress', 'Completed'];

	function getExtension(fileName: string): string {
		const dot = fileName.lastIndexOf('.');
		return dot >= 0 ? fileName.slice(dot).toLowerCase() : '';
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
	}

	function extractFileName(path: string): string {
		return path.split('/').pop() ?? path;
	}

	function getMeta(): FileMetadata {
		const m = data.fileRecord?.metadata;
		if (m && typeof m === 'object' && !Array.isArray(m)) return m as FileMetadata;
		return {};
	}

	const ext = $derived(getExtension(data.fileName));
	const isImage = $derived(imageExtensions.includes(ext));
	const isPdf = $derived(pdfExtensions.includes(ext));
	const effectivePermissions = $derived(
		($page.data as any).effectivePermissions ?? ({} as Record<string, boolean>)
	);
	const canEdit = $derived(effectivePermissions['file.update'] === true);
	const canDelete = $derived(effectivePermissions['file.delete'] === true);
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

<svelte:head>
	<title>{data.fileName} | Denials Tracker</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-6 p-6">
	{#if data.error}
		<div class="rounded-md border border-error-200 bg-error-50 px-6 py-10 text-center">
			<p class="text-error-700">{data.error}</p>
			<a href="/file" class="mt-4 inline-block text-sm text-primary-600 hover:underline">
				&larr; Back to Files
			</a>
		</div>
	{:else if data.signedUrl}
		<!-- Header -->
		<div class="flex items-center justify-between">
			<h1 class="truncate text-2xl font-bold text-surface-900">{extractFileName(data.fileName)}</h1>
			<div class="flex items-center gap-3">
				<a href="/file" class="text-sm text-primary-600 hover:underline">&larr; Back to Files</a>
			</div>
		</div>

		<!-- File Info -->
		{#if data.fileRecord}
			<div class="rounded-md border border-surface-200 bg-white">
				<form
					method="POST"
					action="?/updateFileInfo"
					use:enhance={({ submitter }) => {
						const deletingNow =
							submitter?.getAttribute('formaction')?.includes('deleteFile') ?? false;
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
					<input type="hidden" name="name" value={data.fileName} />
					<div class="space-y-4 p-6">
						<h2 class="text-lg font-semibold text-surface-800">File Info</h2>

						{#if editFileInfo}
							<!-- Edit Mode -->
							<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
								<div>
									<span class="text-xs font-medium text-surface-500">File Path</span>
									<p class="mt-1 text-sm text-surface-800">{data.fileName}</p>
								</div>
								<div>
									<span class="text-xs font-medium text-surface-500">Upload Date</span>
									<p class="mt-1 text-sm text-surface-800">
										{formatDate(data.fileRecord.created_at)}
									</p>
								</div>
								<div>
									<span class="text-xs font-medium text-surface-500">Size</span>
									<p class="mt-1 text-sm text-surface-800">
										{formatBytes(data.fileRecord.size ?? 0)}
									</p>
								</div>
								<div>
									<label for="status-select" class="text-xs font-medium text-surface-500"
										>Status</label
									>
									<select
										id="status-select"
										name="status"
										bind:value={editStatus}
										class="mt-1 block w-full rounded-md border border-surface-300 px-3 py-1.5 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
									>
										{#each fileStatusOptions as option (option)}
											<option value={option}>{option}</option>
										{/each}
									</select>
								</div>
							</div>
							<div>
								<label for="note-input" class="text-xs font-medium text-surface-500">Note</label>
								<textarea
									id="note-input"
									name="note"
									rows="3"
									bind:value={editNote}
									class="mt-1 block w-full rounded-md border border-surface-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
								></textarea>
							</div>
							<div class="flex items-center justify-between">
								<div class="flex gap-2">
									<button
										type="submit"
										class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
									>
										Save
									</button>
									<button
										type="button"
										class="rounded-md border border-surface-300 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50"
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
										<div class="flex items-center gap-2">
											<span class="text-sm text-error-700">Delete this file permanently?</span>
											<button
												type="submit"
												formaction="?/deleteFile"
												disabled={isDeleting}
												class="rounded-md bg-error-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-error-700 disabled:opacity-50"
											>
												{isDeleting ? 'Deleting…' : 'Yes, delete'}
											</button>
											<button
												type="button"
												disabled={isDeleting}
												class="rounded-md border border-surface-300 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 disabled:opacity-50"
												onclick={() => (confirmDelete = false)}
											>
												Cancel
											</button>
										</div>
									{:else}
										<button
											type="button"
											class="rounded-md bg-error-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-error-700"
											onclick={() => (confirmDelete = true)}
										>
											Delete
										</button>
									{/if}
								{/if}
							</div>
						{:else}
							<!-- View Mode -->
							<div class="grid grid-cols-2 gap-4 sm:grid-cols-5">
								<div>
									<span class="text-xs font-medium text-surface-500">File Path</span>
									<p class="mt-1 text-sm text-surface-800">{data.fileName}</p>
								</div>
								<div>
									<span class="text-xs font-medium text-surface-500">Upload Date</span>
									<p class="mt-1 text-sm text-surface-800">
										{formatDate(data.fileRecord.created_at)}
									</p>
								</div>
								<div>
									<span class="text-xs font-medium text-surface-500">Size</span>
									<p class="mt-1 text-sm text-surface-800">
										{formatBytes(data.fileRecord.size ?? 0)}
									</p>
								</div>
								<div>
									<span class="text-xs font-medium text-surface-500">File Type</span>
									<p class="mt-1 text-sm text-surface-800">
										{data.fileRecord.mimetype ?? 'Unknown'}
									</p>
								</div>
								<div>
									<span class="text-xs font-medium text-surface-500">Status</span>
									<p class="mt-1 text-sm">
										<span
											class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {fileStatus ===
											'Completed'
												? 'bg-success-100 text-success-800'
												: fileStatus === 'In Progress'
													? 'bg-warning-100 text-warning-800'
													: 'bg-surface-100 text-surface-600'}"
										>
											{fileStatus}
										</span>
									</p>
								</div>
							</div>
							{#if meta.note}
								<div>
									<span class="text-xs font-medium text-surface-500">Note</span>
									<p class="mt-1 text-sm whitespace-pre-wrap text-surface-700">
										{meta.note}
									</p>
								</div>
							{/if}
							{#if canEdit}
								<div>
									<button
										type="button"
										class="rounded-md border border-primary-300 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50"
										onclick={() => (editFileInfo = true)}
									>
										Edit
									</button>
								</div>
							{/if}
						{/if}
					</div>
				</form>
			</div>
		{/if}

		<!-- Related Claims -->
		{#if data.relatedClaims && data.relatedClaims.length > 0}
			<div class="rounded-md border border-surface-200 bg-white">
				<div class="space-y-4 p-6">
					<h2 class="text-lg font-semibold text-surface-800">Related Claims</h2>
					<div class="overflow-x-auto">
						<table class="w-full text-left text-sm">
							<thead class="border-b border-surface-200 bg-surface-50">
								<tr>
									<th class="px-4 py-2 font-medium text-surface-700">Patient</th>
									<th class="px-4 py-2 font-medium text-surface-700">Date of Service</th>
									<th class="px-4 py-2 font-medium text-surface-700">Labels</th>
									<th class="px-4 py-2 font-medium text-surface-700">Last Note</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-surface-100">
								{#each data.relatedClaims as row (row.note_id)}
									{#if row.notes?.denials?.patients}
										<tr class="hover:bg-surface-50">
											<td class="px-4 py-3">
												<a
													href="/record/{row.notes.denials.patients.id}"
													class="text-primary-600 hover:underline"
												>
													{row.notes.denials.patients.last_name}, {row.notes.denials.patients
														.first_name}
													({formatDate(row.notes.denials.patients.date_of_birth)})
												</a>
											</td>
											<td class="px-4 py-3 font-medium text-surface-800">
												{formatDate(row.notes.denials.service_start_date)}
												{#if row.notes.denials.service_end_date}
													- {formatDate(row.notes.denials.service_end_date)}
												{/if}
											</td>
											<td class="px-4 py-3">
												<div class="flex flex-wrap gap-1">
													{#each row.notes.denials.denials_labels as dl, i (i)}
														{#if dl.labels}
															<span
																class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
																style="background-color: {dl.labels.bg_color}; color: {dl.labels
																	.txt_color};"
															>
																{dl.labels.label_name}
															</span>
														{/if}
													{/each}
												</div>
											</td>
											<td class="px-4 py-3 text-surface-600">
												<span class="text-xs text-surface-400">
													({formatDate(row.notes.created_at)})
												</span>
												{#if row.notes.created_by}
													<span class="font-medium">{row.notes.created_by.username}:</span>
												{/if}
												<span class="line-clamp-2">{row.notes.note}</span>
											</td>
										</tr>
									{/if}
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		{/if}

		<!-- File Preview -->
		<div class="overflow-hidden rounded-md border border-surface-200">
			{#if isImage}
				<img src={data.signedUrl} alt={data.fileName} class="max-h-[80vh] w-full object-contain" />
			{:else if isPdf}
				<iframe src={data.signedUrl} title={data.fileName} class="h-[80vh] w-full"></iframe>
			{:else}
				<div class="px-6 py-10 text-center">
					<p class="text-surface-600">Preview is not available for this file type.</p>
					<a
						href={data.signedUrl}
						download={data.fileName}
						class="mt-4 inline-block rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
					>
						Download File
					</a>
				</div>
			{/if}
		</div>
	{/if}
</div>
