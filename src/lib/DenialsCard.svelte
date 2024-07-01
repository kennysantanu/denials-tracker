<script lang="ts">
	import Ellipsis from '$lib/icons/Ellipsis-vertical.svelte';
	import { enhance } from '$app/forms';
	import { popup } from '@skeletonlabs/skeleton';
	import type { PopupSettings } from '@skeletonlabs/skeleton';

	// Props
	export let denialData;

	// Variables
	let formElement: HTMLFormElement;
	let showAddNewNoteForm: boolean = false;

	// Functions
	const formatDate = (date: String): String => {
		const dateString = date.toString();
		const formattedDate = `${dateString.substring(5, 7)}/${dateString.substring(8, 10)}/${dateString.substring(0, 4)}`;
		return formattedDate;
	};

	const popupFeatured: PopupSettings = {
		event: 'click',
		target: 'popupFeatured',
		placement: 'bottom'
	};
</script>

<!-- Denial List Cards -->
<div class="card space-y-8 p-8">
	<!-- Denial List Card Header -->
	<div class="flex justify-between">
		<div class="flex grow flex-wrap gap-4">
			<div class="grow">
				<div class="grid min-w-48 grid-rows-2">
					<span class="text-slate-500">Date of Service</span>
					{formatDate(denialData.service_start_date)}
					{#if denialData.service_end_date}
						- {formatDate(denialData.service_end_date)}
					{/if}
				</div>
			</div>
			<div class="grow">
				<div class="grid grid-rows-2">
					<span class="text-slate-500">Bill Amount</span>
					${denialData.billed_amount}
				</div>
			</div>
			<div class="grow">
				<div class="grid grid-rows-2">
					<span class="text-slate-500">Paid Amount</span>
					${denialData.paid_amount}
				</div>
			</div>
			<div class="grow">
				<span class="text-slate-500">Labels</span>
				{#if denialData.labels.length > 0}
					<div class="flex flex-row flex-wrap space-x-2">
						{#each denialData.labels as label}
							<span
								class="variant-filled chip"
								style="background-color: {label.bg_color}; color: {label.txt_color};"
								>{label.label_name}</span
							>
						{/each}
					</div>
				{/if}
			</div>
		</div>
		<div>
			<button type="button" class="btn-icon text-tertiary-500" use:popup={popupFeatured}>
				<Ellipsis />
			</button>
			<div class="card shadow-xl" data-popup="popupFeatured">
				<div><button class="btn">Edit</button></div>
				<div><button class="btn">Delete</button></div>
				<div class="bg-surface-100-800-token arrow" />
			</div>
		</div>
	</div>
	<hr />
	<button
		type="button"
		class="btn text-tertiary-500"
		on:click={() => (showAddNewNoteForm = !showAddNewNoteForm)}>+ Add New Note</button
	>

	<!-- Add New Note Form -->
	{#if showAddNewNoteForm}
		<form
			method="POST"
			action="?/createNote"
			id="newNoteForm"
			bind:this={formElement}
			use:enhance={() => {
				showAddNewNoteForm = false;
			}}
		>
			<div class="card space-y-6 p-6">
				<h3 class="h3 text-tertiary-500">Create New Note</h3>
				<input type="hidden" name="denial_id" value={denialData.id} />
				<label class="label">
					<span class="text-tertiary-500">Note</span>
					<textarea class="textarea" rows="4" name="note" />
				</label>
				<div class="space-x-4">
					<button type="submit" class="variant-filled-primary btn">Save</button>
					<button
						type="button"
						class="variant-filled-secondary btn"
						on:click={() => (showAddNewNoteForm = false)}>Cancel</button
					>
				</div>
			</div>
		</form>
	{/if}
	{#if denialData.notes.length > 0}
		{#each denialData.notes as noteData}
			<div class="flex flex-row">
				<div>
					<span>({formatDate(noteData.created_at)})</span>
					<span class="font-bold">{noteData.users.username}:</span>
					<span class="text-surface-800">{noteData.note}</span>
				</div>
				<div>
					<button type="button" class="btn-icon text-surface-800" use:popup={popupFeatured}>
						<Ellipsis />
					</button>
					<div class="card shadow-xl" data-popup="popupFeatured">
						<div><button class="btn">Edit</button></div>
						<div><button class="btn">Delete</button></div>
						<div class="bg-surface-100-800-token arrow" />
					</div>
				</div>
			</div>
		{/each}
	{/if}
</div>
