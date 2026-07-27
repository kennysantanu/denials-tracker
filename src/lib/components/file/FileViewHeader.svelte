<script lang="ts">
	interface Props {
		fileName: string;
		backUrl: string;
		previousFileName: string | null;
		nextFileName: string | null;
		currentIndex: number;
		totalSiblings: number;
	}

	let { fileName, backUrl, previousFileName, nextFileName, currentIndex, totalSiblings }: Props =
		$props();

	function extractFileName(path: string): string {
		return path.split('/').pop() ?? path;
	}

	function viewHref(name: string): string {
		return `/file/view?name=${encodeURIComponent(name)}`;
	}

	const position = $derived(
		currentIndex >= 0 && totalSiblings > 0 ? `${currentIndex + 1} of ${totalSiblings}` : null
	);
</script>

<div class="flex flex-wrap items-center justify-between gap-3">
	<div class="flex min-w-0 items-center gap-3">
		<a href={backUrl} class="shrink-0 text-sm text-primary-600 hover:underline">
			&larr; Back to Files
		</a>
		<h1 class="truncate text-2xl font-bold text-surface-900" title={fileName}>
			{extractFileName(fileName)}
		</h1>
	</div>
	<div class="flex shrink-0 items-center gap-2">
		{#if position}
			<span class="text-sm text-surface-500">{position}</span>
		{/if}
		{#if previousFileName}
			<a href={viewHref(previousFileName)} class="btn preset-outlined-surface-500 btn-sm">
				Previous
			</a>
		{:else}
			<span class="pointer-events-none btn preset-outlined-surface-500 btn-sm opacity-40">
				Previous
			</span>
		{/if}
		{#if nextFileName}
			<a href={viewHref(nextFileName)} class="btn preset-outlined-surface-500 btn-sm"> Next </a>
		{:else}
			<span class="pointer-events-none btn preset-outlined-surface-500 btn-sm opacity-40">
				Next
			</span>
		{/if}
	</div>
</div>
