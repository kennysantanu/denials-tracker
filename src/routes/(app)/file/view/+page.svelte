<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import { unknown } from 'zod';

	export let data: PageData;

	let editFileInfo: boolean = false;
	let fileStatusOptions: string[] = ['Completed', 'In Progress', 'New'];

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

	const convertUTCToLocal = (utcDateString: string) => {
		const utcDate = new Date(utcDateString);
		return utcDate.toLocaleString();
	};

	onMount(async () => {
		if (!data.fileData.name) {
			return;
		}

		const { data: blob } = await data.supabase.storage.from('files').download(data.fileData.name);

		if (!blob) {
			return;
		}

		const pdfUrl = URL.createObjectURL(blob);
		const pdf = document.getElementById('pdf');

		if (!pdf) {
			return;
		}

		pdf.setAttribute('data', pdfUrl);
	});
</script>

<!-- File Info -->
<div class="card">
	<form method="POST" action="?/updateFileInfo">
		<div class="space-y-6 p-6">
			<h3 class="h3 text-tertiary-500">File Info</h3>
			{#if editFileInfo === true}
				<div class="grid grid-cols-5 gap-4">
					<div class="grid grid-rows-2 gap-4">
						<span class="text-slate-500">File Name</span>
						<input type="text" name="name" value={data.fileData.name} class="input" disabled />
						<input type="hidden" name="name" value={data.fileData.name} />
					</div>
					<div class="grid grid-rows-2 gap-4">
						<span class="text-slate-500">Upload Date</span>
						<input
							type="text"
							name="date"
							value={convertUTCToLocal(data.fileData.created_at)}
							class="input"
							disabled
						/>
					</div>
					<div class="grid grid-rows-2 gap-4">
						<span class="text-slate-500">Size</span>
						<input type="number" name="size" value={data.fileData.size} class="input" disabled />
					</div>
					<div class="grid grid-rows-2 gap-4">
						<span class="text-slate-500">File Type</span>
						<input
							type="text"
							name="mimetype"
							value={data.fileData.mimetype}
							class="input"
							disabled
						/>
					</div>
					<div class="grid grid-rows-2">
						<span class="text-slate-500">Status</span>
						<select name="status" class="input" value={data.fileData.metadata.status}>
							{#each fileStatusOptions as option}
								<option value={option}>{option}</option>
							{/each}
						</select>
					</div>
				</div>
				<div>
					<span class="text-slate-500">Note</span>
					<div>
						<textarea rows="4" class="input" name="note" value={data.fileData.metadata.note} />
					</div>
				</div>
				<div class="flex space-x-4">
					<button type="submit" class="variant-filled-primary btn">Save</button>
					<button
						type="button"
						class="variant-filled-secondary btn"
						on:click={() => {
							editFileInfo = false;
						}}>Cancel</button
					>
				</div>
			{:else}
				<div class="grid grid-cols-5 gap-4">
					<div class="grid grid-rows-2 gap-4">
						<span class="text-slate-500">File Name</span>
						{extractFileName(data.fileData.name)}
					</div>
					<div class="grid grid-rows-2 gap-4">
						<span class="text-slate-500">Upload Date</span>
						{convertUTCToLocal(data.fileData.created_at)}
					</div>
					<div class="grid grid-rows-2 gap-4">
						<span class="text-slate-500">Size</span>
						{formatFileSize(data.fileData.size)}
					</div>
					<div class="grid grid-rows-2 gap-4">
						<span class="text-slate-500">File Type</span>
						{#if data.fileData.mimetype === 'application/pdf'}
							PDF
						{:else}
							Unknown
						{/if}
					</div>
					<div class="grid grid-rows-2 gap-4">
						<span class="text-slate-500">Status</span>
						{data.fileData.metadata.status}
					</div>
				</div>
				<div>
					<span class="text-slate-500">Note</span>
					<div class="whitespace-pre-wrap">{data.fileData.metadata.note}</div>
				</div>
				<div>
					<button
						class="variant-filled-primary btn"
						on:click={() => {
							editFileInfo = true;
						}}>Edit</button
					>
				</div>
			{/if}
		</div>
	</form>
</div>

<!-- Show File -->
<object id="pdf" data="" type="application/pdf" width="100%" height="1000px"></object>
