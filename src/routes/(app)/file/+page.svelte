<script lang="ts">
	import type { PageData } from './$types';
	import { FileDropzone } from '@skeletonlabs/skeleton';

	export let data: PageData;
	export let form: FormData;

	let uploadList: FileList;

	// Functions

	const formatFileSize = (size: number) => {
		if (size < 1024) {
			return `${size} B`;
		} else if (size < 1024 * 1024) {
			return `${(size / 1024).toFixed(2)} KB`;
		} else if (size < 1024 * 1024 * 1024) {
			return `${(size / (1024 * 1024)).toFixed(2)} MB`;
		} else {
			return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
		}
	};

	const extractFileName = (path: string) => {
		return path.split('/').pop();
	};

	const validateFiles = (fileList: FileList) => {
		const invalidChars = /[<>:"\/\\|&?*]/;
		for (const file of fileList) {
			if (invalidChars.test(file.name)) {
				alert(`Invalid character in file name: ${file.name}`);
				return false;
			}
		}
		return true;
	};

	const handleSubmit = (event: Event) => {
		if (!validateFiles(uploadList)) {
			event.preventDefault();
		}
	};

	const clearFileList = (): void => {
		uploadList = null;
	};
</script>

<!-- Upload New File -->
<div class="card space-y-6 p-6">
	<h3 class="h3 text-tertiary-500">Upload New File</h3>
	<form method="POST" action="?/uploadNewFile" class="space-y-6" enctype="multipart/form-data">
		<FileDropzone name="files" bind:files={uploadList} multiple required accept=".pdf" />
		{#if uploadList}
			<ul class="list-inside list-decimal space-y-4">
				{#each uploadList as file}
					<li>
						<span>{file.name}</span>
						<span>({formatFileSize(file.size)})</span>
					</li>
				{/each}
			</ul>
		{/if}
		<div class="space-x-4">
			<button
				type="submit"
				class="variant-filled-primary btn"
				on:click={() => {
					handleSubmit(event);
				}}>Upload</button
			>
			<button
				type="button"
				class="variant-filled-secondary btn"
				on:click={() => {
					clearFileList();
				}}>Clear</button
			>
		</div>
	</form>
</div>

<!-- File List -->
<div class="card space-y-6 p-6">
	<h3 class="h3 text-tertiary-500">File List</h3>
	<form method="POST" action="?/getFileList">
		<div class="flex space-x-4">
			<input type="date" name="date" class="input" />
			<button class="variant-filled-primary btn">Show</button>
		</div>
	</form>
	<ul class="list-inside list-decimal space-y-4">
		{#if form?.fileList}
			<div class="grid grid-cols-3 gap-4">
				<p class="text-slate-500">File Name</p>
				<p class="text-slate-500">Size</p>
				<p class="text-slate-500">Status</p>
			</div>
			{#each form.fileList as file}
				<div class="grid grid-cols-3 gap-4">
					<li>
						<a href="/file/view?name={file.name}" target="_blank">{extractFileName(file.name)}</a>
					</li>
						<p>{formatFileSize(file.size)}</p>
						<p>{file.metadata.status}</p>
				</div>
			{/each}
		{/if}
	</ul>
</div>
