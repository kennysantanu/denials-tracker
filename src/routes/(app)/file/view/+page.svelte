<script lang="ts">
	import { page } from '$app/stores';
	import { FileDocumentViewer, FileInfoPanel, FileRelatedClaims } from '$lib/components/file';

	function extractFileName(path: string): string {
		return path.split('/').pop() ?? path;
	}

	let { data } = $props();

	const effectivePermissions = $derived(
		($page.data as any).effectivePermissions ?? ({} as Record<string, boolean>)
	);
	const canEdit = $derived(effectivePermissions['file.update'] === true);
	const canDelete = $derived(effectivePermissions['file.delete'] === true);
</script>

<svelte:head>
	<title>{data.fileName} | Denials Tracker</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-6">
	{#if data.error}
		<div class="rounded-base border border-error-200 bg-error-50 px-6 py-10 text-center">
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
			<FileInfoPanel fileName={data.fileName} fileRecord={data.fileRecord} {canEdit} {canDelete} />
		{/if}

		<!-- Related Claims -->
		<FileRelatedClaims relatedClaims={data.relatedClaims} />

		<!-- File Preview -->
		<FileDocumentViewer fileName={data.fileName} signedUrl={data.signedUrl} />
	{/if}
</div>
