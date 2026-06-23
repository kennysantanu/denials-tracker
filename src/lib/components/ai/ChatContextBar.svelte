<script lang="ts">
	import User from '@lucide/svelte/icons/user';
	import FileText from '@lucide/svelte/icons/file-text';
	import Info from '@lucide/svelte/icons/info';
	import type { ChatContext } from '$lib/stores/chatContext.svelte';

	interface PatientSummary {
		first_name?: string;
		last_name?: string;
	}

	let { context }: { context: ChatContext } = $props();

	const patient = $derived(context.pageData?.patient as PatientSummary | undefined);
	const reportCount = $derived(context.pageData?.recordCount as number | undefined);
	const route = $derived(context.route || '/');
</script>

<div class="flex items-center gap-2 border-b border-surface-200 bg-surface-50 px-4 py-1.5 text-xs">
	{#if context.patientId && patient}
		<User class="h-3.5 w-3.5 shrink-0 text-success-600" />
		<span class="text-surface-500">Patient</span>
		<span class="truncate font-medium text-surface-900">
			{patient.last_name}, {patient.first_name}
		</span>
	{:else if context.pageData}
		<FileText class="h-3.5 w-3.5 shrink-0 text-primary-600" />
		<span class="text-surface-500">Report</span>
		<span class="truncate font-medium text-surface-900">
			{reportCount ?? '?'} records
		</span>
	{:else}
		<Info class="h-3.5 w-3.5 shrink-0 text-surface-400" />
		<span class="text-surface-500">General context — {route}</span>
	{/if}
</div>
