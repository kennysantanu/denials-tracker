<svelte:head>
	<title>Record — Denials Tracker</title>
</svelte:head>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatDate } from '$lib/utils';

	let { data } = $props();

	let query = $state('');

	let filteredPatients = $derived(
		query.trim().length === 0
			? data.patients
			: data.patients.filter((p: typeof data.patients[number]) => {
					const q = query.toLowerCase();
					return (
						p.last_name.toLowerCase().includes(q) ||
						p.first_name.toLowerCase().includes(q) ||
						`${p.last_name}, ${p.first_name}`.toLowerCase().includes(q)
					);
				})
	);
</script>

<div class="mx-auto max-w-3xl p-6">
	<h1 class="mb-6 text-2xl font-bold">Patient Records</h1>

	<div class="relative">
		<input
			type="text"
			bind:value={query}
			placeholder="Search patients by name…"
			class="w-full rounded-lg border border-surface-300 bg-surface-50 px-4 py-3 text-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
		/>
	</div>

	<ul class="mt-4 divide-y divide-surface-200 rounded-lg border border-surface-200">
		{#each filteredPatients as patient (patient.id)}
			<li>
				<button
					type="button"
					class="w-full px-4 py-3 text-left transition-colors hover:bg-surface-100"
					onclick={() => goto(`/record/${patient.id}`)}
				>
					<span class="font-medium">{patient.last_name}, {patient.first_name}</span>
					<span class="ml-2 text-sm text-surface-500">— DOB: {formatDate(patient.date_of_birth)}</span>
				</button>
			</li>
		{:else}
			<li class="px-4 py-6 text-center text-surface-500">
				{query.trim() ? 'No patients match your search.' : 'No patients found.'}
			</li>
		{/each}
	</ul>
</div>
