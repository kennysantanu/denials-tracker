<script lang="ts">
	import type { Database } from '$lib/supabase';
	import { enhance } from '$app/forms';
	import { toastSuccess, toastError } from '$lib/toast';
	import { invalidateAll } from '$app/navigation';
	import { formatDate } from '$lib/utils';
	import DenialEditForm from './DenialEditForm.svelte';
	import DenialNoteList from './DenialNoteList.svelte';
	import { InsuranceNoteModal } from '$lib/components/modals';
	import { openChatDrawer, updateChatContext } from '$lib/stores/chatContext.svelte';

	type DenialRow = Database['public']['Tables']['denials']['Row'];
	type InsuranceRow = Database['public']['Tables']['insurances']['Row'];
	type LabelRow = Database['public']['Tables']['labels']['Row'];
	type NoteRow = Database['public']['Tables']['notes']['Row'] & {
		created_by_user?: { username: string | null } | null;
	};

	interface Props {
		denial: DenialRow & { insurances?: InsuranceRow[]; labels?: LabelRow[]; notes?: NoteRow[] };
		permissions: Record<string, boolean>;
		patientId: number;
		insurances: InsuranceRow[];
		labels: LabelRow[];
		aiEnabled?: boolean;
	}

	let { denial, permissions, patientId, insurances, labels, aiEnabled = false }: Props = $props();

	let editing = $state(false);
	let selectedInsurance = $state<InsuranceRow | null>(null);

	let billedDisplay = $derived(
		denial.billed_amount != null ? `$${denial.billed_amount.toFixed(2)}` : '—'
	);
	let paidDisplay = $derived(
		denial.paid_amount != null ? `$${denial.paid_amount.toFixed(2)}` : '—'
	);

	function handleSummarize() {
		updateChatContext({ denialId: denial.id, patientId });
		openChatDrawer('Summarize this denial and its notes.');
	}
</script>

<div class="rounded-lg border border-surface-300 bg-surface-50 p-4 shadow-sm">
	{#if editing}
		<DenialEditForm {denial} {insurances} {labels} {patientId} oncancel={() => (editing = false)} />
	{:else}
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div class="min-w-0 flex-1 space-y-2">
				<!-- Service dates -->
				<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
					<span class="font-medium text-surface-700">
						Service: {formatDate(denial.service_start_date)}
						{#if denial.service_end_date}
							– {formatDate(denial.service_end_date)}
						{/if}
					</span>
					{#if denial.follow_up_date}
						<span class="text-warning-600">
							Follow-up: {formatDate(denial.follow_up_date)}
						</span>
					{/if}
				</div>

				<!-- Amounts -->
				<div class="flex gap-4 text-sm">
					<span>Billed: <strong>{billedDisplay}</strong></span>
					<span>Paid: <strong>{paidDisplay}</strong></span>
				</div>

				<!-- Status badge -->
				<div class="flex flex-wrap items-center gap-2">
					{#if denial.is_closed}
						<span
							class="rounded-full bg-surface-300 px-2 py-0.5 text-xs font-medium text-surface-700"
						>
							Closed
						</span>
					{:else}
						<span
							class="rounded-full bg-success-200 px-2 py-0.5 text-xs font-medium text-success-800"
						>
							Open
						</span>
					{/if}

					<!-- Labels -->
					{#if denial.labels?.length}
						{#each denial.labels as label (label.id)}
							<span
								class="rounded-full px-2 py-0.5 text-xs font-medium"
								style="background-color: {label.bg_color}; color: {label.txt_color};"
							>
								{label.label_name}
							</span>
						{/each}
					{/if}
				</div>

				<!-- Insurances -->
				{#if denial.insurances?.length}
					<div class="text-sm text-surface-600">
						Insurance:
						{#each denial.insurances as ins, i (ins.id)}
							{#if i > 0},
							{/if}
							<button
								type="button"
								class="text-primary-600 underline hover:text-primary-800"
								onclick={() => (selectedInsurance = ins)}
							>
								{ins.name}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Action buttons -->
			<div class="flex flex-wrap gap-2 sm:shrink-0">
				{#if aiEnabled && permissions['generate_summary']}
					<button
						type="button"
						class="btn preset-outlined-primary-500 btn-sm"
						onclick={handleSummarize}
					>
						🤖 Summarize
					</button>
				{/if}
				{#if permissions['update_denial']}
					<button
						type="button"
						class="btn preset-outlined-surface-500 btn-sm"
						onclick={() => (editing = true)}
					>
						Edit
					</button>
				{/if}
				{#if permissions['delete_denial']}
					<form
						method="POST"
						action="?/deleteDenial"
						use:enhance={() => {
							return async ({ result }) => {
								if (result.type === 'success') {
									toastSuccess('Denial deleted');
									await invalidateAll();
								} else if (result.type === 'failure') {
									toastError((result.data as Record<string, string>)?.error || 'Delete failed');
								} else if (result.type === 'error') {
									toastError('Something went wrong');
								}
							};
						}}
					>
						<input type="hidden" name="id" value={denial.id} />
						<input type="hidden" name="patientId" value={patientId} />
						<button type="submit" class="btn preset-outlined-error-500 btn-sm"> Delete </button>
					</form>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Notes section -->
	<div class="mt-4 border-t border-surface-200 pt-3">
		<DenialNoteList notes={denial.notes ?? []} denialId={denial.id} {permissions} {patientId} />
	</div>
</div>

{#if selectedInsurance}
	<InsuranceNoteModal
		insurance={selectedInsurance}
		canEdit={!!permissions['manage_insurances']}
		onclose={() => (selectedInsurance = null)}
	/>
{/if}
