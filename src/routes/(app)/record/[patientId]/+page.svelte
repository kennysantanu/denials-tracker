<svelte:head>
	<title>{data.patient.last_name}, {data.patient.first_name} — Denials Tracker</title>
</svelte:head>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { toastSuccess, toastError } from '$lib/toast';
	import { formatDate } from '$lib/utils';
	import DenialCard from '$lib/components/denial/DenialCard.svelte';

	let { data } = $props();

	let openDenials = $derived(data.denials.filter((d: (typeof data.denials)[number]) => !d.is_closed));
	let closedDenials = $derived(data.denials.filter((d: (typeof data.denials)[number]) => d.is_closed));

	let showClosed = $state(false);
	let showNewDenialForm = $state(false);
</script>

<div class="mx-auto max-w-5xl p-6">
	<!-- Patient Header -->
	<div class="mb-8 rounded-lg border border-surface-200 bg-surface-50 p-6">
		<div class="flex items-start justify-between">
			<div>
				<h1 class="text-2xl font-bold">
					{data.patient.last_name}, {data.patient.first_name}
				</h1>
				<p class="mt-1 text-surface-500">
					DOB: {formatDate(data.patient.date_of_birth)}
				</p>
				{#if data.patient.note}
					<p class="mt-2 text-sm text-surface-600">{data.patient.note}</p>
				{/if}
			</div>
			<button
				type="button"
				class="text-sm text-primary-600 hover:underline"
				onclick={() => goto('/record')}
			>
				← Back to Records
			</button>
		</div>
	</div>

	<!-- Open Denials -->
	<section class="mb-8">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold">Open Claims ({openDenials.length})</h2>
			{#if data.permissions['create_denial']}
				<button
					type="button"
					class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
					onclick={() => (showNewDenialForm = !showNewDenialForm)}
				>
					{showNewDenialForm ? 'Cancel' : '+ New Denial'}
				</button>
			{/if}
		</div>

		{#if showNewDenialForm}
			<div class="mb-6 rounded-lg border border-surface-200 bg-white p-6">
				<h3 class="mb-4 text-lg font-medium">New Denial</h3>
				<form
					method="POST"
					action="?/createDenial"
					use:enhance={() => {
						return async ({ result, update }) => {
							if (result.type === 'success') {
								toastSuccess('Denial created');
								showNewDenialForm = false;
								await update();
							} else if (result.type === 'failure') {
							toastError('Error', String(result.data?.error ?? 'Failed to create denial'));
							}
						};
					}}
				>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label for="service_start_date" class="mb-1 block text-sm font-medium">
								Service Start Date <span class="text-red-500">*</span>
							</label>
							<input
								type="date"
								id="service_start_date"
								name="service_start_date"
								required
								class="w-full rounded border border-surface-300 px-3 py-2"
							/>
						</div>
						<div>
							<label for="service_end_date" class="mb-1 block text-sm font-medium">
								Service End Date
							</label>
							<input
								type="date"
								id="service_end_date"
								name="service_end_date"
								class="w-full rounded border border-surface-300 px-3 py-2"
							/>
						</div>
						<div>
							<label for="billed_amount" class="mb-1 block text-sm font-medium">
								Billed Amount
							</label>
							<input
								type="number"
								id="billed_amount"
								name="billed_amount"
								step="0.01"
								min="0"
								class="w-full rounded border border-surface-300 px-3 py-2"
							/>
						</div>
						<div>
							<label for="paid_amount" class="mb-1 block text-sm font-medium">
								Paid Amount
							</label>
							<input
								type="number"
								id="paid_amount"
								name="paid_amount"
								step="0.01"
								min="0"
								class="w-full rounded border border-surface-300 px-3 py-2"
							/>
						</div>
						<div>
							<label for="follow_up_date" class="mb-1 block text-sm font-medium">
								Follow-up Date
							</label>
							<input
								type="date"
								id="follow_up_date"
								name="follow_up_date"
								class="w-full rounded border border-surface-300 px-3 py-2"
							/>
						</div>
					</div>

					<!-- Insurance Checkboxes -->
					{#if data.allInsurances.length > 0}
						<fieldset class="mt-4">
							<legend class="mb-2 text-sm font-medium">Insurances</legend>
							<div class="flex flex-wrap gap-3">
								{#each data.allInsurances as ins (ins.id)}
									<label class="inline-flex items-center gap-1.5 text-sm">
										<input type="checkbox" name="insurance_ids" value={ins.id} />
										{ins.name}
									</label>
								{/each}
							</div>
						</fieldset>
					{/if}

					<!-- Label Checkboxes -->
					{#if data.allLabels.length > 0}
						<fieldset class="mt-4">
							<legend class="mb-2 text-sm font-medium">Labels</legend>
							<div class="flex flex-wrap gap-3">
								{#each data.allLabels as label (label.id)}
									<label class="inline-flex items-center gap-1.5 text-sm">
										<input type="checkbox" name="label_ids" value={label.id} />
										<span
											class="rounded px-1.5 py-0.5 text-xs"
											style="background-color: {label.bg_color}; color: {label.txt_color};"
										>
											{label.label_name}
										</span>
									</label>
								{/each}
							</div>
						</fieldset>
					{/if}

					<div class="mt-6">
						<button
							type="submit"
							class="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
						>
							Create Denial
						</button>
					</div>
				</form>
			</div>
		{/if}

		{#if openDenials.length > 0}
			<div class="space-y-4">
				{#each openDenials as denial (denial.id)}
					<DenialCard
						{denial}
						patientId={data.patient.id}
						insurances={data.allInsurances}
						labels={data.allLabels}
						permissions={data.permissions}
					/>
				{/each}
			</div>
		{:else}
			<p class="text-surface-500">No open claims.</p>
		{/if}
	</section>

	<!-- Closed Denials -->
	<section>
		<button
			type="button"
			class="mb-4 flex items-center gap-2 text-lg font-semibold text-surface-600 hover:text-surface-800"
			onclick={() => (showClosed = !showClosed)}
		>
			<span class="inline-block transition-transform" class:rotate-90={showClosed}>▶</span>
			Closed Claims ({closedDenials.length})
		</button>

		{#if showClosed && closedDenials.length > 0}
			<div class="space-y-4">
				{#each closedDenials as denial (denial.id)}
					<DenialCard
						{denial}
						patientId={data.patient.id}
						insurances={data.allInsurances}
						labels={data.allLabels}
						permissions={data.permissions}
					/>
				{/each}
			</div>
		{:else if showClosed}
			<p class="text-surface-500">No closed claims.</p>
		{/if}
	</section>
</div>
