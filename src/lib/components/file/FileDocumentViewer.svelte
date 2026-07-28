<script lang="ts">
	interface Props {
		fileName: string;
		signedUrl: string;
	}

	let { fileName, signedUrl }: Props = $props();

	const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
	const pdfExtensions = ['.pdf'];

	function getExtension(name: string): string {
		const dot = name.lastIndexOf('.');
		return dot >= 0 ? name.slice(dot).toLowerCase() : '';
	}

	const ext = $derived(getExtension(fileName));
	const isImage = $derived(imageExtensions.includes(ext));
	const isPdf = $derived(pdfExtensions.includes(ext));
</script>

<div class="overflow-hidden rounded-base border border-surface-200">
	{#if isImage}
		<img src={signedUrl} alt={fileName} class="max-h-[85vh] w-full object-contain" />
	{:else if isPdf}
		<iframe src={signedUrl} title={fileName} class="h-[85vh] w-full"></iframe>
	{:else}
		<div class="px-6 py-10 text-center">
			<p class="text-surface-600">Preview is not available for this file type.</p>
			<a href={signedUrl} download={fileName} class="mt-4 btn preset-filled-primary-500">
				Download File
			</a>
		</div>
	{/if}
</div>
