<script lang="ts">
	import Ellipsis from '$lib/icons/Ellipsis-vertical.svelte';
	import { enhance } from '$app/forms';
	import { popup } from '@skeletonlabs/skeleton';
	import { onMount } from 'svelte';

	// Props
	export let data;
	export let form;
	export let noteData;
	export let getDenials;
	export let selectedPatientId;

	// Variables
	let showEditNoteForm: boolean = false;
	let showAttachFileForm: boolean = false;
	$: fileList = form?.fileList ?? [];
	let attachmentList: string[] = [];

	// Functions
	const formatDate = (date: String): String => {
		const dateString = date.toString();
		const formattedDate = `${dateString.substring(5, 7)}/${dateString.substring(8, 10)}/${dateString.substring(0, 4)}`;
		return formattedDate;
	};

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

	onMount(() => {
		if (noteData.files) {
			attachmentList = noteData.files.map((file) => file.name);
		}
	});
</script>

<div class="flex">
	{#if !showEditNoteForm}
		<div>
			<span>({formatDate(noteData.created_at)})</span>
			<span class="font-bold">{noteData.created_by.username}:</span>
			<span class="text-surface-800">{noteData.note}</span>
			{#if noteData.files.length > 0}
				<div class="space-x-2">
					{#each noteData.files as file}
						<a class="variant-filled chip" href="/file/view?name={file.name}" target="_blank"
							>{extractFileName(file.name)}</a
						>
					{/each}
				</div>
			{/if}
		</div>
		<div>
			<button
				type="button"
				class="btn-icon h-5 text-surface-800"
				use:popup={{ event: 'click', target: 'popup-' + noteData.id, placement: 'bottom' }}
			>
				<Ellipsis />
			</button>
			<div class="card shadow-xl" data-popup="popup-{noteData.id}">
				{#if data.user?.role.permissions.note_edit == true}
					<div><button class="btn" on:click={() => (showEditNoteForm = true)}>Edit</button></div>
				{:else}
					<div><button class="btn" disabled>Edit</button></div>
				{/if}
				{#if data.user?.role.permissions.note_delete == true}
					<div>
						<form
							method="POST"
							action="?/deleteNote"
							use:enhance={({ cancel }) => {
								if (!confirm('Delete note?')) {
									cancel();
								}

								return async ({ update }) => {
									getDenials(selectedPatientId);
									update();
								};
							}}
						>
							<input hidden name="note_id" value={noteData.id} />
							<button type="submit" class="btn">Delete</button>
						</form>
					</div>
				{:else}
					<div><button class="btn" disabled>Delete</button></div>
				{/if}
			</div>
		</div>
	{:else}
		<form
			method="POST"
			action="?/updateNote"
			class="grow"
			use:enhance={() => {
				return async ({ update }) => {
					showEditNoteForm = false;
					getDenials(selectedPatientId);
					update();
				};
			}}
		>
			<div class="flex flex-col gap-6">
				<input hidden name="note_id" value={noteData.id} />
				<input hidden name="attachmentList" value={attachmentList} />
				<textarea rows="4" class="input" name="note" value={noteData.note} />
				<div>
					{#if data.user?.role.permissions.attachment_add == true}
						<button
							type="button"
							class="btn text-tertiary-500"
							on:click={() => (showAttachFileForm = !showAttachFileForm)}>+ Attach File</button
						>
					{:else}
						<button type="button" class="btn text-tertiary-500" disabled>+ Attach File</button>
					{/if}
					{#each attachmentList as attachment}
						<button
							class="variant-filled chip m-2 hover:variant-filled-error"
							on:click={(event) => {
								event.preventDefault(),
									(attachmentList = attachmentList.filter((item) => item !== attachment));
							}}
						>
							<span>{attachment}</span>
							<span>x</span>
						</button>
					{/each}
					{#if showAttachFileForm}
						<div class="card space-y-6 p-6">
							<h3 class="h3 text-tertiary-500">File List</h3>
							<form method="POST" action="?/getFileList" use:enhance>
								<div class="flex space-x-4">
									<input type="date" name="date" class="input" required />
									<button class="variant-filled-primary btn">Show</button>
								</div>
							</form>
							<ul class="list-inside list-decimal space-y-4">
								{#if fileList.length > 0}
									<div class="grid grid-cols-3 gap-4">
										<p class="text-slate-500">File Name</p>
										<p class="text-slate-500">Size</p>
										<p class="text-slate-500">Status</p>
									</div>
									{#each fileList as file}
										<div class="grid grid-cols-4 gap-4">
											<li>
												<a href="/file/view?name={file.name}" target="_blank"
													>{extractFileName(file.name)}</a
												>
											</li>
											<p>{formatFileSize(file.size)}</p>
											<p>{file.metadata.status}</p>
											<div>
												<button
													class="variant-filled-primary btn"
													on:click={(event) => {
														event.preventDefault(),
															attachmentList.push(file.name),
															(attachmentList = attachmentList);
													}}>Add</button
												>
											</div>
										</div>
									{/each}
								{/if}
							</ul>
							<button
								type="button"
								class="variant-filled-primary btn"
								on:click={() => {
									(showAttachFileForm = false), (fileList = []);
								}}>Close</button
							>
						</div>
					{/if}
				</div>
				<div class="space-x-4">
					<button type="submit" class="variant-filled-primary btn">Save</button>
					<button
						type="button"
						class="variant-filled-secondary btn"
						on:click={() => (showEditNoteForm = false)}>Cancel</button
					>
				</div>
			</div>
		</form>
	{/if}
</div>
