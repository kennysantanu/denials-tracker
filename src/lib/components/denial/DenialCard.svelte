<script lang="ts">
	import type { Database } from '$lib/supabase';
	import { enhance } from '$app/forms';
	import { toastSuccess, toastError } from '$lib/toast';
	import { invalidateAll } from '$app/navigation';
	import { formatDate } from '$lib/utils';
	import DenialEditForm from './DenialEditForm.svelte';
	import DenialCopyModal from './DenialCopyModal.svelte';
	import DenialNoteList from './DenialNoteList.svelte';
	import { InsuranceNoteModal } from '$lib/components/modals';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	type DenialRow = Database['public']['Tables']['denials']['Row'];
	type InsuranceRow = Database['public']['Tables']['insurances']['Row'];
	type LabelRow = Database['public']['Tables']['labels']['Row'];
	type FileRow = Database['public']['Tables']['files']['Row'];
	type NoteRow = Database['public']['Tables']['notes']['Row'] & {
		created_by_user?: { username: string | null } | null;
		notes_files?: { file_name: string; files: FileRow | null }[];
	};

	interface Props {
		denial: DenialRow & { insurances?: InsuranceRow[]; labels?: LabelRow[]; notes?: NoteRow[] };
		effectivePermissions: Record<string, boolean>;
		patientId: number;
		insurances: InsuranceRow[];
		labels: LabelRow[];
		searchQuery?: string;
	}

	let {
		denial,
		effectivePermissions,
		patientId,
		insurances,
		labels,
		searchQuery = ''
	}: Props = $props();

	let editing = $state(false);
	let copying = $state(false);
	let selectedInsurance = $state<InsuranceRow | null>(null);
	let menuOpen = $state(false);
	let canShowMenu = $derived(
		effectivePermissions['denial.update'] ||
			effectivePermissions['denial.delete'] ||
			effectivePermissions['denial.create']
	);

	let billedDisplay = $derived(
		denial.billed_amount != null ? `$${denial.billed_amount.toFixed(2)}` : '—'
	);
	let paidDisplay = $derived(
		denial.paid_amount != null ? `$${denial.paid_amount.toFixed(2)}` : '—'
	);
</script>

<div class="s card border border-surface-200 p-4">
	{#if editing}
		<DenialEditForm {denial} {insurances} {labels} {patientId} oncancel={() => (editing = false)} />
	{:else}
		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0 flex-1 space-y-3">
				<!-- Primary details -->
				<div class="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
					<div class="min-w-0">
						<p class="text-sm text-surface-600">Service date</p>
						<p class="font-bold text-surface-700">
							{formatDate(denial.service_start_date)}
							{#if denial.service_end_date}
								- {formatDate(denial.service_end_date)}
							{/if}
						</p>
					</div>

					<div class="grid grid-cols-2 gap-2 sm:contents">
						<div>
							<p class="text-sm text-surface-600">Billed</p>
							<p class="font-bold text-surface-900">{billedDisplay}</p>
						</div>
						<div>
							<p class="text-sm text-surface-600">Paid</p>
							<p class="font-bold text-surface-900">{paidDisplay}</p>
						</div>
					</div>
				</div>

				<div class="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
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
						<div class="col-span-2 text-sm text-surface-600">
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

				{#if denial.follow_up_date}
					{@const today = new Date()}
					{@const followUp = new Date(denial.follow_up_date + 'T00:00:00')}
					{@const isOverdue = followUp < today && !denial.is_closed}
					{@const diffDays = Math.ceil(
						(followUp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
					)}
					<span
						class={isOverdue
							? 'font-medium text-red-600'
							: diffDays <= 7 && !denial.is_closed
								? 'font-medium text-warning-600'
								: 'text-warning-600'}
					>
						{#if isOverdue}
							<TriangleAlert class="inline-block h-3.5 w-3.5 -translate-y-px" />
							Overdue ·
						{:else if diffDays <= 7 && !denial.is_closed}
							<TriangleAlert class="inline-block h-3.5 w-3.5 -translate-y-px" />
						{/if}
						Follow-up: {formatDate(denial.follow_up_date)}
					</span>
				{/if}
			</div>

			{#if canShowMenu}
				<div class="relative shrink-0">
					<button
						type="button"
						class="btn hover:bg-surface-200-800"
						title="Actions"
						onclick={() => (menuOpen = !menuOpen)}
					>
						⋮
					</button>
					{#if menuOpen}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="absolute right-0 z-10 mt-1 min-w-32 border border-surface-200 bg-white py-1 shadow-lg"
							onmouseleave={() => (menuOpen = false)}
						>
							{#if effectivePermissions['denial.update']}
								<button
									type="button"
									class="w-full px-4 py-2 text-left text-sm hover:bg-surface-100"
									onclick={() => {
										editing = true;
										menuOpen = false;
									}}
								>
									Edit
								</button>
							{/if}
							{#if effectivePermissions['denial.create']}
								<button
									type="button"
									class="w-full px-4 py-2 text-left text-sm hover:bg-surface-100"
									onclick={() => {
										copying = true;
										menuOpen = false;
									}}
								>
									Copy
								</button>
							{/if}
							{#if effectivePermissions['denial.delete']}
								<form
									method="POST"
									action="?/deleteDenial"
									use:enhance={() => {
										menuOpen = false;
										return async ({ result }) => {
											if (result.type === 'success') {
												toastSuccess('Denial deleted');
												await invalidateAll();
											} else if (result.type === 'failure') {
												toastError(
													(result.data as Record<string, string>)?.error || 'Delete failed'
												);
											} else if (result.type === 'error') {
												toastError('Something went wrong');
											}
										};
									}}
								>
									<input type="hidden" name="id" value={denial.id} />
									<input type="hidden" name="patientId" value={patientId} />
									<button
										type="submit"
										class="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-surface-100"
										onclick={(e) => {
											if (!confirm('Delete this denial? This cannot be undone.'))
												e.preventDefault();
										}}
									>
										Delete
									</button>
								</form>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Notes section -->
	<div class="mt-4 border-t border-surface-200 pt-3">
		<DenialNoteList
			notes={denial.notes ?? []}
			denialId={denial.id}
			{effectivePermissions}
			{patientId}
			{searchQuery}
		/>
	</div>
</div>

{#if selectedInsurance}
	<InsuranceNoteModal
		insurance={selectedInsurance}
		canEdit={!!effectivePermissions['insurance.update']}
		onclose={() => (selectedInsurance = null)}
	/>
{/if}

{#if copying}
	<DenialCopyModal {denial} {insurances} {labels} {patientId} onclose={() => (copying = false)} />
{/if}
