<script lang="ts">
	import User from '@lucide/svelte/icons/user';
	import FileText from '@lucide/svelte/icons/file-text';
	import Info from '@lucide/svelte/icons/info';
	import { Popover } from '@skeletonlabs/skeleton-svelte';
	import type { ChatContext } from '$lib/stores/chatContext.svelte';
	import type { ContextMeta } from '$lib/stores/chatStore.svelte';

	interface PatientSummary {
		first_name?: string;
		last_name?: string;
	}

	let { context, contextMeta }: { context: ChatContext; contextMeta: ContextMeta | null } =
		$props();

	const patient = $derived(context.pageData?.patient as PatientSummary | undefined);
	const reportCount = $derived(context.pageData?.recordCount as number | undefined);

	const ROUTE_LABELS: Record<string, string> = {
		'/dashboard': 'Dashboard',
		'/record': 'Records',
		'/report': 'Report',
		'/report/kpis': 'KPIs',
		'/file': 'Files',
		'/file/view': 'File viewer',
		'/setting': 'Settings',
		'/signout': 'Sign out'
	};

	const routeLabel = $derived(ROUTE_LABELS[context.route] ?? context.route ?? '/');
	const tokenLabel = $derived(
		contextMeta ? `${contextMeta.estimatedTokens.toLocaleString()} est. tokens` : null
	);
</script>

<div
	class="relative flex min-h-8 items-center justify-between gap-2 border-b border-surface-200 bg-surface-50 px-4 py-1.5 text-xs"
>
	<div class="flex min-w-0 items-center gap-2">
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
			<span class="truncate text-surface-500">General context - {routeLabel}</span>
		{/if}
	</div>

	{#if contextMeta && tokenLabel}
		<Popover>
			<Popover.Trigger class="btn h-6 min-h-6 shrink-0 gap-1 btn-sm px-2 hover:preset-tonal">
				<Info class="h-3.5 w-3.5" />
				<span>{tokenLabel}</span>
			</Popover.Trigger>
			<Popover.Positioner>
				<Popover.Content
					class="relative z-[70] w-64 rounded-container border border-surface-200 bg-white p-3 shadow-lg"
				>
					<div class="space-y-1 text-xs text-surface-700">
						<div class="flex justify-between gap-3">
							<span>System</span><span>{contextMeta.systemPromptChars.toLocaleString()} chars</span>
						</div>
						<div class="flex justify-between gap-3">
							<span>Page context</span><span
								>{contextMeta.pageContextChars.toLocaleString()} chars</span
							>
						</div>
						<div class="flex justify-between gap-3">
							<span>History</span><span>{contextMeta.historyChars.toLocaleString()} chars</span>
						</div>
						<div class="flex justify-between gap-3">
							<span>Tools</span><span>{contextMeta.toolSchemaChars.toLocaleString()} chars</span>
						</div>
						<div class="flex justify-between gap-3">
							<span>Summary</span><span
								>{contextMeta.longThreadSummaryChars.toLocaleString()} chars</span
							>
						</div>
						{#if contextMeta.modelContextWindow}
							<div class="flex justify-between gap-3 border-t border-surface-100 pt-1">
								<span>Window</span><span
									>{contextMeta.modelContextWindow.toLocaleString()} tokens</span
								>
							</div>
						{/if}
					</div>
				</Popover.Content>
			</Popover.Positioner>
		</Popover>
	{/if}
</div>
