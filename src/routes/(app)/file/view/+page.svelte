<svelte:head>
	<title>View File — Denials Tracker</title>
</svelte:head>

<script lang="ts">
	let { data } = $props();

	const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
	const pdfExtensions = ['.pdf'];

	function getExtension(fileName: string): string {
		const dot = fileName.lastIndexOf('.');
		return dot >= 0 ? fileName.slice(dot).toLowerCase() : '';
	}

	const ext = $derived(getExtension(data.fileName));
	const isImage = $derived(imageExtensions.includes(ext));
	const isPdf = $derived(pdfExtensions.includes(ext));
</script>

<div class="mx-auto max-w-4xl space-y-6 p-6">
	{#if data.error}
		<div class="rounded-md border border-error-200 bg-error-50 px-6 py-10 text-center">
			<p class="text-error-700">{data.error}</p>
			<a href="/file" class="mt-4 inline-block text-sm text-primary-600 hover:underline">
				&larr; Back to Files
			</a>
		</div>
	{:else if data.signedUrl}
		<div class="flex items-center justify-between">
			<h1 class="truncate text-2xl font-bold text-surface-900">{data.fileName}</h1>
			<div class="flex items-center gap-3">
				<a
					href={data.signedUrl}
					download={data.fileName}
					class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
				>
					Download
				</a>
				<a href="/file" class="text-sm text-primary-600 hover:underline">
					&larr; Back to Files
				</a>
			</div>
		</div>

		<p class="text-xs text-warning-600">
			This link expires in 60 seconds. Refresh the page to generate a new one.
		</p>

		<div class="overflow-hidden rounded-md border border-surface-200">
			{#if isImage}
				<img src={data.signedUrl} alt={data.fileName} class="max-h-[80vh] w-full object-contain" />
			{:else if isPdf}
				<iframe src={data.signedUrl} title={data.fileName} class="h-[80vh] w-full"></iframe>
			{:else}
				<div class="px-6 py-10 text-center">
					<p class="text-surface-600">
						Preview is not available for this file type.
					</p>
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
