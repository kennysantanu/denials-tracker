<script lang="ts">
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import {
		FileDocumentViewer,
		FileInfoPanel,
		FileRelatedClaims,
		FileSiblingList,
		FileSiblingDrawer,
		FileViewMobileTabs,
		FileAddDenialForm
	} from '$lib/components/file';

	let { data } = $props();

	const effectivePermissions = $derived(
		($page.data as any).effectivePermissions ?? ({} as Record<string, boolean>)
	);
	const canEdit = $derived(effectivePermissions['file.update'] === true);
	const canDelete = $derived(effectivePermissions['file.delete'] === true);
	const canCreateDenial = $derived(effectivePermissions['denial.create'] === true);
	const canCreatePatient = $derived(effectivePermissions['patient.create'] === true);
	const canCreateNote = $derived(effectivePermissions['note.create'] === true);

	let filesDrawerOpen = $state(false);

	function viewHref(name: string): string {
		return `/file/view?name=${encodeURIComponent(name)}`;
	}

	const position = $derived(
		data.currentIndex >= 0 && data.siblings.length > 0
			? `${data.currentIndex + 1} of ${data.siblings.length}`
			: null
	);
</script>

<svelte:head>
	<title>{data.fileName} | Denials Tracker</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-6">
	{#if data.error}
		<div class="rounded-base border border-error-200 bg-error-50 px-6 py-10 text-center">
			<p class="text-error-700">{data.error}</p>
			<a href={resolve('/file')} class="mt-4 inline-block text-sm text-primary-600 hover:underline">
				&larr; Back to Files
			</a>
		</div>
	{:else if data.signedUrl}
		<div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
			<!-- Breadcrumb -->
			<nav class="mb-4 flex items-center gap-1.5 text-sm text-surface-500" aria-label="Breadcrumb">
				<a href="/file" class="hover:text-primary-600 hover:underline">Files</a>
				<span>/</span>
				<span class="font-medium text-surface-800">{data.fileName}</span>
			</nav>

			<div class="flex shrink-0 items-center gap-2">
				{#if position}
					<span class="text-sm text-surface-500">{position}</span>
				{/if}
				{#if filesDrawerOpen !== undefined}
					<button
						type="button"
						class="btn hidden preset-outlined-surface-500 btn-sm md:inline-flex"
						onclick={() => (filesDrawerOpen = true)}
					>
						Files
					</button>
				{/if}
				{#if data.previousFileName}
					<a href={viewHref(data.previousFileName)} class="btn preset-outlined-surface-500 btn-sm">
						Previous
					</a>
				{:else}
					<span class="pointer-events-none btn preset-outlined-surface-500 btn-sm opacity-40">
						Previous
					</span>
				{/if}
				{#if data.nextFileName}
					<a href={viewHref(data.nextFileName)} class="btn preset-outlined-surface-500 btn-sm">
						Next
					</a>
				{:else}
					<span class="pointer-events-none btn preset-outlined-surface-500 btn-sm opacity-40">
						Next
					</span>
				{/if}
			</div>
		</div>

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
			{canCreateDenial}
			{canCreatePatient}
			{canCreateNote}
			siblings={data.siblings}
			relatedClaims={data.relatedClaims}
		/>

		<!-- Tablet (md) and desktop (xl) layout -->
		<div
			class="hidden gap-6 md:grid md:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[minmax(300px,400px)_minmax(0,1fr)]"
		>
			<!-- Related Claims column -->
			<div class="space-y-4 xl:sticky xl:top-20">
				<!-- File Info -->
				{#if data.fileRecord}
					<div>
						<FileInfoPanel
							fileName={data.fileName}
							fileRecord={data.fileRecord}
							{canEdit}
							{canDelete}
						/>
					</div>
				{/if}

				<div class="card border border-surface-200 bg-white p-3">
					<h2 class="mb-2 px-2 text-sm font-semibold text-surface-600">Related Claims</h2>
					<FileAddDenialForm
						fileName={data.fileName}
						{canCreateDenial}
						{canCreatePatient}
						{canCreateNote}
					/>
					<FileRelatedClaims relatedClaims={data.relatedClaims} />
				</div>
			</div>

			<!-- Document column -->
			<div class="min-w-0">
				<FileDocumentViewer fileName={data.fileName} signedUrl={data.signedUrl} />
			</div>
		</div>
	{/if}
</div>
