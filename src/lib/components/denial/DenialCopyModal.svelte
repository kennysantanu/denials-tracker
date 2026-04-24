<script lang="ts">
	import type { Database } from '$lib/supabase';
	import { enhance } from '$app/forms';
	import { toastSuccess, toastError } from '$lib/toast';
	import { goto, invalidateAll } from '$app/navigation';
	import { formatDate } from '$lib/utils';
	import { InsuranceCombobox, LabelPillSelect } from '$lib/components/ui';

	type DenialRow = Database['public']['Tables']['denials']['Row'];
	type InsuranceRow = Database['public']['Tables']['insurances']['Row'];
	type LabelRow = Database['public']['Tables']['labels']['Row'];
	type NoteRow = Database['public']['Tables']['notes']['Row'];

	interface Props {
		denial: DenialRow & { insurances?: InsuranceRow[]; labels?: LabelRow[]; notes?: NoteRow[] };
		insurances: InsuranceRow[];
		labels: LabelRow[];
		patientId: number;
		onclose: () => void;
	}

	let { denial, insurances, labels, patientId, onclose }: Props = $props();

	let sourceInsuranceIds = $derived(denial.insurances?.map((i) => i.id) ?? []);
	let sourceLabelIds = $derived(denial.labels?.map((l) => l.id) ?? []);
	let sourceNotes = $derived(denial.notes ?? []);

	// All notes selected by default
	let selectedNoteIds = $state<number[]>([]);
	$effect(() => {
		selectedNoteIds = sourceNotes.map((n) => n.id);
	});

	let serviceStartDate = $state('');
	let serviceEndDate = $state('');
	let billedAmount = $state('');
	let paidAmount = $state('');

	$effect(() => {
		billedAmount = denial.billed_amount != null ? String(denial.billed_amount) : '';
		paidAmount = denial.paid_amount != null ? String(denial.paid_amount) : '';
	});
	let followUpDate = $state('');

	function toInputDate(dateStr: string | null): string {
		if (!dateStr) return '';
		if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
		const d = new Date(dateStr);
		if (isNaN(d.getTime())) return '';
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}

	function dateFromToday(days: number): string {
		const d = new Date();
		d.setDate(d.getDate() + days);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function toggleNote(id: number) {
		if (selectedNoteIds.includes(id)) {
			selectedNoteIds = selectedNoteIds.filter((n) => n !== id);
		} else {
			selectedNoteIds = [...selectedNoteIds, id];
		}
	}

	function truncate(text: string, max = 80): string {
		return text.length > max ? text.slice(0, max) + '…' : text;
	}
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
	onkeydown={(e) => e.key === 'Escape' && onclose()}
>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="relative z-50 w-full max-w-xl overflow-y-auto rounded-xl bg-white shadow-2xl"
		style="max-height: 90vh;"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-surface-200 px-5 py-4">
			<div>
				<h2 class="text-base font-semibold text-surface-900">Copy Denial</h2>
				<p class="mt-0.5 text-xs text-surface-500">
					Copying from: <strong>{formatDate(denial.service_start_date)}</strong>
					{#if denial.service_end_date}
						– {formatDate(denial.service_end_date)}
					{/if}
					— update dates for the new encounter
				</p>
			</div>
			<button
				type="button"
				class="text-surface-400 hover:text-surface-600"
				onclick={onclose}
				aria-label="Close"
			>
				✕
			</button>
		</div>

		<form
			method="POST"
			action="?/copyDenial"
			class="space-y-4 px-5 py-4"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						toastSuccess('Denial copied');
						await invalidateAll();
						onclose();
					} else if (result.type === 'failure') {
						toastError((result.data as Record<string, string>)?.error || 'Copy failed');
						await update({ reset: false });
					} else if (result.type === 'redirect') {
						goto(result.location);
					} else if (result.type === 'error') {
						toastError('Something went wrong');
					}
				};
			}}
		>
			<input type="hidden" name="source_denial_id" value={denial.id} />
			<input type="hidden" name="patientId" value={patientId} />

			<!-- Hidden inputs for selected note IDs -->
			{#each selectedNoteIds as noteId (noteId)}
				<input type="hidden" name="copy_note_ids" value={noteId} />
			{/each}

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<!-- Service start date -->
				<label class="label">
					<span class="label-text text-sm font-medium"
						>Service Start Date <span class="text-red-500">*</span></span
					>
					<input
						type="date"
						name="service_start_date"
						class="input"
						bind:value={serviceStartDate}
						required
					/>
				</label>

				<!-- Service end date -->
				<label class="label">
					<span class="label-text text-sm font-medium">Service End Date</span>
					<input type="date" name="service_end_date" class="input" bind:value={serviceEndDate} />
				</label>

				<!-- Billed amount -->
				<label class="label">
					<span class="label-text text-sm font-medium">Billed Amount</span>
					<input
						type="number"
						name="billed_amount"
						class="input"
						step="0.01"
						min="0"
						bind:value={billedAmount}
					/>
				</label>

				<!-- Paid amount -->
				<label class="label">
					<span class="label-text text-sm font-medium">Paid Amount</span>
					<input
						type="number"
						name="paid_amount"
						class="input"
						step="0.01"
						min="0"
						bind:value={paidAmount}
					/>
				</label>

				<!-- Follow-up date -->
				<div class="label sm:col-span-2">
					<span class="label-text text-sm font-medium">Follow-up Date</span>
					<input type="date" name="follow_up_date" class="input" bind:value={followUpDate} />
					<div class="mt-1.5 flex flex-wrap gap-1">
						{#each [{ label: '2 wks', days: 14 }, { label: '30 days', days: 30 }, { label: '60 days', days: 60 }, { label: '90 days', days: 90 }] as preset (preset.days)}
							<button
								type="button"
								onclick={() => (followUpDate = dateFromToday(preset.days))}
								class="rounded-full border border-surface-300 px-2.5 py-0.5 text-xs font-medium text-surface-600 transition-colors hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 {followUpDate ===
								dateFromToday(preset.days)
									? 'border-primary-500 bg-primary-50 text-primary-700'
									: ''}"
							>
								{preset.label}
							</button>
						{/each}
					</div>
				</div>
			</div>

			<!-- Insurances -->
			{#if insurances.length}
				<div>
					<InsuranceCombobox {insurances} selected={sourceInsuranceIds} />
				</div>
			{/if}

			<!-- Labels -->
			{#if labels.length}
				<div>
					<LabelPillSelect {labels} selected={sourceLabelIds} />
				</div>
			{/if}

			<!-- Notes to copy -->
			<div class="rounded-lg border border-surface-200 bg-surface-50 p-3">
				<p class="mb-2 text-sm font-medium text-surface-700">Notes to copy</p>
				{#if sourceNotes.length === 0}
					<p class="text-xs text-surface-500">No notes on the source denial.</p>
				{:else}
					<div class="space-y-2">
						{#each sourceNotes as note (note.id)}
							<label class="flex cursor-pointer items-start gap-2">
								<input
									type="checkbox"
									class="mt-0.5 checkbox shrink-0"
									checked={selectedNoteIds.includes(note.id)}
									onchange={() => toggleNote(note.id)}
								/>
								<span class="text-xs text-surface-700">{truncate(note.note)}</span>
							</label>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Actions -->
			<div class="flex gap-2 border-t border-surface-200 pt-3">
				<button type="submit" class="btn preset-filled-primary-500 btn-sm">Copy Denial</button>
				<button type="button" class="btn preset-outlined-surface-500 btn-sm" onclick={onclose}>
					Cancel
				</button>
			</div>
		</form>
	</div>
</div>
