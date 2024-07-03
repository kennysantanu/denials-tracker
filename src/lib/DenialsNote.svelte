<script lang="ts">
	import Ellipsis from '$lib/icons/Ellipsis-vertical.svelte';
	import { enhance } from '$app/forms';
	import { popup } from '@skeletonlabs/skeleton';

	// Props
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
</script>

<div class="flex gap-2">
	<span>({formatDate(noteData.created_at)})</span>
	<span class="font-bold">{noteData.users.username}:</span>
	{#if !showEditNoteForm}
		<span class="text-surface-800">{noteData.note}</span>
		<div>
			<button
				type="button"
				class="btn-icon text-surface-800"
				use:popup={{ event: 'click', target: 'popup-' + noteData.id, placement: 'bottom' }}
			>
				<Ellipsis />
			</button>
			<div class="card shadow-xl" data-popup="popup-{noteData.id}">
				<div><button class="btn" on:click={() => (showEditNoteForm = true)}>Edit</button></div>
				<div><button class="btn">Delete</button></div>
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
				<textarea rows=4 class="input" name="note" value={noteData.note} />
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
