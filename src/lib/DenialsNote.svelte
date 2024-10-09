<script lang="ts">
	import Ellipsis from '$lib/icons/Ellipsis-vertical.svelte';
	import { enhance } from '$app/forms';
	import { popup } from '@skeletonlabs/skeleton';

	// Props
	export let data;
	export let noteData;
	export let getDenials;
	export let selectedPatientId;

	// Variables
	let showEditNoteForm: boolean = false;

	// Functions
	const formatDate = (date: String): String => {
		const dateString = date.toString();
		const formattedDate = `${dateString.substring(5, 7)}/${dateString.substring(8, 10)}/${dateString.substring(0, 4)}`;
		return formattedDate;
	};

	const extractFileName = (path: string) => {
		return path.split('/').pop();
	};
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
				<textarea rows="4" class="input" name="note" value={noteData.note} />
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
