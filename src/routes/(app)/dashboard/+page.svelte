<script lang="ts">
	import { formatDate } from '$lib/utils';
	import { setChatContext } from '$lib/stores/chatContext.svelte';

	let { data } = $props();

	function formatCurrency(value: number | null): string {
		if (value == null) return '—';
		return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	// Set AI chat context for dashboard
	$effect(() => {
		setChatContext({
			route: '/dashboard',
			pageData: {
				totalOpen: data.stats.totalOpen,
				totalBilled: data.stats.totalBilled,
				totalPaid: data.stats.totalPaid,
				recoveryRate: data.stats.recoveryRate
			}
		});
	});
</script>

<svelte:head>
	<title>Dashboard — Denials Tracker</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header + Quick Actions -->
	<div class="flex flex-wrap items-center justify-between gap-4">
		<h1 class="text-2xl font-bold text-surface-900">Dashboard</h1>
		<div class="flex gap-2">
			{#if data.canCreateDenial}
				<a
					href="/record"
					class="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-600 transition-colors"
				>
					+ New Denial
				</a>
			{/if}
			{#if data.canManagePatients}
				<a
					href="/setting/manage/patients"
					class="rounded-lg border border-surface-300 bg-white px-4 py-2 text-sm font-medium text-surface-700 shadow-sm hover:bg-surface-50 transition-colors"
				>
					+ New Patient
				</a>
			{/if}
		</div>
	</div>

	<!-- Summary Cards -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<div class="rounded-xl border border-surface-200 bg-white p-5 shadow-sm">
			<p class="text-sm font-medium text-surface-500">Open Denials</p>
			<p class="mt-1 text-3xl font-bold text-surface-900">{data.stats.totalOpen}</p>
		</div>

		{#if data.canViewReports}
			<div class="rounded-xl border border-surface-200 bg-white p-5 shadow-sm">
				<p class="text-sm font-medium text-surface-500">Total Billed</p>
				<p class="mt-1 text-3xl font-bold text-surface-900">{formatCurrency(data.stats.totalBilled)}</p>
			</div>

			<div class="rounded-xl border border-surface-200 bg-white p-5 shadow-sm">
				<p class="text-sm font-medium text-surface-500">Total Paid</p>
				<p class="mt-1 text-3xl font-bold text-emerald-600">{formatCurrency(data.stats.totalPaid)}</p>
			</div>

			<div class="rounded-xl border border-surface-200 bg-white p-5 shadow-sm">
				<p class="text-sm font-medium text-surface-500">Recovery Rate</p>
				<p class="mt-1 text-3xl font-bold text-primary-600">
					{data.stats.recoveryRate != null ? data.stats.recoveryRate.toFixed(1) + '%' : '—'}
				</p>
			</div>
		{/if}
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Follow-ups Due This Week -->
		<div class="rounded-xl border border-surface-200 bg-white shadow-sm">
			<div class="border-b border-surface-200 px-5 py-4">
				<h2 class="text-lg font-semibold text-surface-900">Follow-ups Due This Week</h2>
			</div>
			<div class="p-5">
				{#if data.followUps.length === 0}
					<p class="text-sm text-surface-400">No follow-ups due this week.</p>
				{:else}
					<ul class="divide-y divide-surface-100">
						{#each data.followUps as denial}
							{@const patient = denial.patients}
							<li class="py-3 first:pt-0 last:pb-0">
								<a
									href="/record/{denial.patient_id}"
									class="group flex items-center justify-between gap-2 rounded-lg px-2 py-1 -mx-2 hover:bg-surface-50 transition-colors"
								>
									<div class="min-w-0">
										<p class="text-sm font-medium text-surface-900 group-hover:text-primary-600 truncate">
											{patient?.last_name}, {patient?.first_name}
										</p>
										<p class="text-xs text-surface-500">
											Service: {formatDate(denial.service_start_date)} · Due: {formatDate(denial.follow_up_date)}
										</p>
									</div>
									<span class="shrink-0 text-sm font-semibold text-surface-700">
										{formatCurrency(denial.billed_amount)}
									</span>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>

		<!-- Denials by Label -->
		<div class="rounded-xl border border-surface-200 bg-white shadow-sm">
			<div class="border-b border-surface-200 px-5 py-4">
				<h2 class="text-lg font-semibold text-surface-900">Denials by Label</h2>
			</div>
			<div class="p-5">
				{#if data.denialsByLabel.length === 0}
					<p class="text-sm text-surface-400">No labeled denials found.</p>
				{:else}
					<div class="flex flex-wrap gap-3">
						{#each data.denialsByLabel as item}
							{@const label = item.label}
							<div class="flex items-center gap-2 rounded-full border border-surface-200 px-3 py-1.5 shadow-sm">
								<span
									class="inline-block h-3 w-3 rounded-full"
									style="background-color: {label?.bg_color ?? '#6b7280'}"
								></span>
								<span class="text-sm font-medium text-surface-700">{label?.label_name ?? 'Unknown'}</span>
								<span class="rounded-full bg-surface-100 px-2 py-0.5 text-xs font-semibold text-surface-600">
									{item.count}
								</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Recent Activity -->
	<div class="rounded-xl border border-surface-200 bg-white shadow-sm">
		<div class="border-b border-surface-200 px-5 py-4">
			<h2 class="text-lg font-semibold text-surface-900">Recent Activity</h2>
		</div>
		<div class="p-5">
			{#if data.recentActivity.length === 0}
				<p class="text-sm text-surface-400">No recent activity.</p>
			{:else}
				<ul class="divide-y divide-surface-100">
					{#each data.recentActivity as entry}
						<li class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
							<div class="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary-400"></div>
							<div class="min-w-0">
								<p class="text-sm text-surface-700">
									<span class="font-medium capitalize">{entry.action}</span>
									<span class="text-surface-500">{entry.resource_type}</span>
									{#if entry.resource_id}
										<span class="text-surface-400">#{entry.resource_id}</span>
									{/if}
								</p>
								<p class="text-xs text-surface-400">
									{formatDate(entry.created_at, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
								</p>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>
