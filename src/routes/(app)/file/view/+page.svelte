<script lang="ts">
	import { page } from '$app/stores';
	import {
		FileDocumentViewer,
		FileInfoPanel,
		FileRelatedClaims,
		FileViewHeader,
		FileSiblingList,
		FileSiblingDrawer,
		FileViewMobileTabs
	} from '$lib/components/file';

	let { data } = $props();

	const effectivePermissions = $derived(
		($page.data as any).effectivePermissions ?? ({} as Record<string, boolean>)
	);
	const canEdit = $derived(effectivePermissions['file.update'] === true);
	const canDelete = $derived(effectivePermissions['file.delete'] === true);

	let filesDrawerOpen = $state(false);
</script>

<svelte:head>
	<title>{data.fileName} | Denials Tracker</title>
</svelte:head>

<div class="mx-auto max-w-[1600px] space-y-6">
	{#if data.error}
		<div class="rounded-base border border-error-200 bg-error-50 px-6 py-10 text-center">
			<p class="text-error-700">{data.error}</p>
			<a href="/file" class="mt-4 inline-block text-sm text-primary-600 hover:underline">
				&larr; Back to Files
			</a>
		</div>
	{:else if data.signedUrl}
		<FileViewHeader
			fileName={data.fileName}
			backUrl={data.backUrl}
			previousFileName={data.previousFileName}
			nextFileName={data.nextFileName}
			currentIndex={data.currentIndex}
			totalSiblings={data.siblings.length}
			onOpenFiles={() => (filesDrawerOpen = true)}
		/>

		<!-- File Info: compact summary bar, directly under the header, above everything else -->
		{#if data.fileRecord}
			<div class="hidden md:block">
				<FileInfoPanel
					fileName={data.fileName}
					fileRecord={data.fileRecord}
					{canEdit}
					{canDelete}
				/>
			</div>
		{/if}

		{#if filesDrawerOpen}
			<FileSiblingDrawer
				siblings={data.siblings}
				currentFileName={data.fileName}
				onclose={() => (filesDrawerOpen = false)}
			/>
		{/if}

		<!-- Mobile tabs (below md) -->
		<FileViewMobileTabs
			fileName={data.fileName}
			signedUrl={data.signedUrl}
			fileRecord={data.fileRecord}
			{canEdit}
			{canDelete}
			siblings={data.siblings}
			relatedClaims={data.relatedClaims}
		/>

		<!-- Tablet (md) and desktop (xl) layout -->
		<div
			class="hidden gap-6 md:grid md:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(240px,280px)_minmax(0,1fr)_minmax(300px,360px)]"
		>
			<!-- Files column (desktop only; tablet uses the header's Files drawer) -->
			<div class="hidden xl:sticky xl:top-20 xl:block">
				<div class="card border border-surface-200 bg-white p-3">
					<h2 class="mb-2 px-2 text-sm font-semibold text-surface-600">Files</h2>
					<FileSiblingList siblings={data.siblings} currentFileName={data.fileName} />
				</div>
			</div>

			<!-- Document column -->
			<div class="min-w-0">
				<FileDocumentViewer fileName={data.fileName} signedUrl={data.signedUrl} />
			</div>

			<!-- Related Claims column -->
			<div class="xl:sticky xl:top-20">
				<div class="card border border-surface-200 bg-white p-3">
					<h2 class="mb-2 px-2 text-sm font-semibold text-surface-600">Related Claims</h2>
					<FileRelatedClaims relatedClaims={data.relatedClaims} />
				</div>
			</div>
		</div>
	{/if}
</div>
