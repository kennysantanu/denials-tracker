<svelte:head>
	<title>Report — Denials Tracker</title>
</svelte:head>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatDate } from '$lib/utils';
	import { setChatContext } from '$lib/stores/chatContext.svelte';

	let { data } = $props();

	let startDate = $state(data.startDate);
	let endDate = $state(data.endDate);
	let includeClosed = $state(data.includeClosed);

	function generateReport() {
		goto(`/report?startDate=${startDate}&endDate=${endDate}&includeClosed=${includeClosed}`);
	}

	function formatCurrency(value: number | null | undefined): string {
		if (value == null) return '$0.00';
		return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	const totalBilled = $derived(
		data.reportData.reduce((sum: number, r: any) => sum + (r.billed_amount ?? 0), 0)
	);
	const totalPaid = $derived(
		data.reportData.reduce((sum: number, r: any) => sum + (r.paid_amount ?? 0), 0)
	);
	const recoveryRate = $derived(totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0);

	// Set AI chat context for report
	$effect(() => {
		setChatContext({
			route: '/report',
			pageData: {
				startDate,
				endDate,
				includeClosed,
				totalBilled,
				totalPaid,
				recordCount: data.reportData.length
			}
		});
	});
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-bold text-surface-900">Report</h1>

	<!-- Filters -->
	<div class="no-print flex flex-wrap items-end gap-4 rounded-lg border border-surface-300 bg-surface-50 p-4">
		<div class="flex flex-col gap-1">
			<label for="startDate" class="text-sm font-medium text-surface-700">Start Date</label>
			<input
				id="startDate"
				type="date"
				bind:value={startDate}
				class="rounded border border-surface-300 px-3 py-2 text-sm"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="endDate" class="text-sm font-medium text-surface-700">End Date</label>
			<input
				id="endDate"
				type="date"
				bind:value={endDate}
				class="rounded border border-surface-300 px-3 py-2 text-sm"
			/>
		</div>
		<label class="flex items-center gap-2 text-sm text-surface-700">
			<input type="checkbox" bind:checked={includeClosed} class="rounded" />
			Include Closed Claims
		</label>
		<button
			onclick={generateReport}
			class="rounded bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
		>
			Generate Report
		</button>
		<button
			onclick={() => window.print()}
			class="rounded border border-surface-300 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-100"
		>
			Print
		</button>
	</div>

	<!-- Report Table -->
	<div class="overflow-x-auto">
		<table class="w-full text-left text-sm">
			<thead>
				<tr class="border-b border-surface-300 text-surface-600">
					<th class="px-3 py-2">Patient Name</th>
					<th class="px-3 py-2">Service Date</th>
					<th class="px-3 py-2 text-right">Billed Amount</th>
					<th class="px-3 py-2 text-right">Paid Amount</th>
					<th class="px-3 py-2">Status</th>
					<th class="px-3 py-2">Insurances</th>
				</tr>
			</thead>
			<tbody>
				{#each data.reportData as row}
					<tr class="border-b border-surface-200 hover:bg-surface-50">
						<td class="px-3 py-2">
							{row.patients?.first_name ?? ''}
							{row.patients?.last_name ?? ''}
						</td>
						<td class="px-3 py-2">{formatDate(row.service_start_date)}</td>
						<td class="px-3 py-2 text-right">{formatCurrency(row.billed_amount)}</td>
						<td class="px-3 py-2 text-right">{formatCurrency(row.paid_amount)}</td>
						<td class="px-3 py-2">
							{#if row.is_closed}
								<span class="rounded bg-surface-200 px-2 py-0.5 text-xs text-surface-600">Closed</span>
							{:else}
								<span class="rounded bg-primary-100 px-2 py-0.5 text-xs text-primary-700">Open</span>
							{/if}
						</td>
						<td class="px-3 py-2">
							{#if row.denials_insurances?.length}
								{row.denials_insurances.map((di: any) => di.insurances?.name).filter(Boolean).join(', ')}
							{:else}
								—
							{/if}
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="6" class="px-3 py-8 text-center text-surface-400">No records found for the selected date range.</td>
					</tr>
				{/each}
			</tbody>
			{#if data.reportData.length > 0}
				<tfoot>
					<tr class="border-t-2 border-surface-400 font-semibold text-surface-800">
						<td class="px-3 py-2">Total ({data.reportData.length} records)</td>
						<td class="px-3 py-2"></td>
						<td class="px-3 py-2 text-right">{formatCurrency(totalBilled)}</td>
						<td class="px-3 py-2 text-right">{formatCurrency(totalPaid)}</td>
						<td class="px-3 py-2">Recovery: {recoveryRate.toFixed(1)}%</td>
						<td class="px-3 py-2"></td>
					</tr>
				</tfoot>
			{/if}
		</table>
	</div>
</div>

<style>
	@media print {
		.no-print {
			display: none !important;
		}

		table {
			font-size: 11px;
		}

		th,
		td {
			padding: 4px 6px;
		}
	}
</style>
