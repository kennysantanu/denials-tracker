<script lang="ts">
	import Ellipsis from '$lib/icons/Ellipsis-vertical.svelte';
	import { enhance } from '$app/forms';
	import { popup } from '@skeletonlabs/skeleton';
	import DenialsNote from '$lib/DenialsNote.svelte';

	// Props
	export let denialData;
	export let getDenials;
	export let selectedPatientId;
	export let labelsData;

	// Variables
	let formElement: HTMLFormElement;
	let showAddNewNoteForm: boolean = false;
	let showEditDenialForm: boolean = false;

	// Functions
	const formatDate = (date: String): String => {
		const dateString = date.toString();
		const formattedDate = `${dateString.substring(5, 7)}/${dateString.substring(8, 10)}/${dateString.substring(0, 4)}`;
		return formattedDate;
	};
</script>

<!-- Denial List Cards -->
<div class="card space-y-8 p-8">
	<!-- Denial List Card Header -->
	{#if !showEditDenialForm}
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
				<button
					type="button"
					class="btn-icon text-surface-800"
					use:popup={{
						event: 'click',
						target: 'popupDenial-' + denialData.id,
						placement: 'bottom'
					}}
				>
					<Ellipsis />
				</button>
				<div class="card shadow-xl" data-popup="popupDenial-{denialData.id}">
					<div><button class="btn" on:click={() => (showEditDenialForm = true)}>Edit</button></div>
					<div>
						<button type="submit" class="btn">Delete</button>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<form
			method="POST"
			action="?/updateDenial"
			use:enhance={() => {
				return async ({ update }) => {
					showEditDenialForm = false;
					getDenials(selectedPatientId);
					update();
				};
			}}
		>
			<div class="card space-y-6 p-6">
				<h3 class="h3 text-tertiary-500">Edit Denial</h3>
				<div class="space-y-6">
					<input type="hidden" name="denial_id" value={denialData.id} />
					<div class="grid-row grid grid-cols-2 gap-6">
						<label class="label">
							<span class="text-tertiary-500">From</span>
							<input
								class="input"
								type="date"
								name="service_start_date"
								value={denialData.service_start_date}
								required
							/>
						</label>
						<label class="label">
							<span class="text-tertiary-500">To (optional)</span>
							<input
								class="input"
								type="date"
								name="service_end_date"
								value={denialData.service_end_date}
							/>
						</label>
						<label class="label">
							<span class="text-tertiary-500">Bill Amount</span>
							<input
								class="input"
								type="number"
								name="billed_amount"
								value={denialData.billed_amount}
								min="0"
								step="0.01"
							/>
						</label>
						<label class="label">
							<span class="text-tertiary-500">Paid Amount</span>
							<input
								class="input"
								type="number"
								name="paid_amount"
								value={denialData.paid_amount}
								min="0"
								step="0.01"
							/>
						</label>
					</div>
					<label class="label">
						<span class="text-tertiary-500">Labels</span>
						<select class="select" name="label_id" multiple required>
							{#each labelsData as label}
								<option value={label.id}>{label.label_name}</option>
							{/each}
						</select>
					</label>
				</div>
				<div class="space-x-4">
					<button type="submit" class="variant-filled-primary btn">Save</button>
					<button
						type="button"
						class="variant-filled-secondary btn"
						on:click={() => (showEditDenialForm = false)}>Cancel</button
					>
				</div>
			</div>
		</form>
	{/if}

	<hr />

	<!-- Denial Notes -->
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

	<!-- Denial Note List -->
	{#if denialData.notes.length > 0}
		{#each denialData.notes as noteData}
			<DenialsNote {noteData} {getDenials} {selectedPatientId} />
		{/each}
	{/if}
</div>
