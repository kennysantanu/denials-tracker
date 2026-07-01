<script lang="ts">
	import type { Database } from '$lib/supabase';
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { toastSuccess, toastError } from '$lib/toast';
	import { goto, invalidateAll } from '$app/navigation';
	import { formatDate } from '$lib/utils';
	import { InsuranceCombobox, LabelPillSelect } from '$lib/components/ui';

	type DenialRow = Database['public']['Tables']['denials']['Row'];
	type InsuranceRow = Database['public']['Tables']['insurances']['Row'];
	type LabelRow = Database['public']['Tables']['labels']['Row'];

	interface Props {
		denial: DenialRow & { insurances?: InsuranceRow[]; labels?: LabelRow[] };
		insurances: InsuranceRow[];
		labels: LabelRow[];
		patientId: number;
		oncancel: () => void;
	}

	let { denial, insurances, labels, patientId, oncancel }: Props = $props();

	let currentInsuranceIds = $derived(denial.insurances?.map((i) => i.id) ?? []);
	let currentLabelIds = $derived(denial.labels?.map((l) => l.id) ?? []);
	let followUpDate = $state(untrack(() => toInputDate(denial.follow_up_date)));

	function dateFromToday(days: number): string {
		const d = new Date();
		d.setDate(d.getDate() + days);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function toInputDate(dateStr: string | null): string {
		if (!dateStr) return '';
		// If already YYYY-MM-DD, return as-is to avoid UTC timezone shift
		if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
		const d = new Date(dateStr);
		if (isNaN(d.getTime())) return '';
		// Use local date parts to avoid UTC shift
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}
</script>

<form
	method="POST"
	action="?/updateDenial"
	class="space-y-4"
	use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				toastSuccess('Denial updated');
				await invalidateAll();
				oncancel();
			} else if (result.type === 'failure') {
				toastError((result.data as Record<string, string>)?.error || 'Update failed');
				await update({ reset: false });
			} else if (result.type === 'redirect') {
				goto(result.location);
			} else if (result.type === 'error') {
				toastError('Something went wrong');
			}
		};
	}}
>
	<input type="hidden" name="id" value={denial.id} />
	<input type="hidden" name="patientId" value={patientId} />

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<!-- Service start date -->
		<label class="label">
			<span class="label-text text-sm font-medium">Service Start Date</span>
			<input
				type="date"
				name="service_start_date"
				class="input"
				value={toInputDate(denial.service_start_date)}
				required
			/>
		</label>

		<!-- Service end date -->
		<label class="label">
			<span class="label-text text-sm font-medium">Service End Date</span>
			<input
				type="date"
				name="service_end_date"
				class="input"
				value={toInputDate(denial.service_end_date)}
			/>
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
				value={denial.billed_amount ?? ''}
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
				value={denial.paid_amount ?? ''}
			/>
		</label>

		<!-- Follow-up date -->
		<div class="label">
			<span class="label-text text-sm font-medium">Follow-up Date</span>
			<input type="date" name="follow_up_date" class="input" bind:value={followUpDate} />
			<div class="mt-1.5 flex flex-wrap gap-1">
				{#each [{ label: 'Today', days: 0 }, { label: '2 wks', days: 14 }, { label: '30 days', days: 30 }, { label: '60 days', days: 60 }, { label: '90 days', days: 90 }] as preset (preset.days)}
					<button
						type="button"
						onclick={() => (followUpDate = dateFromToday(preset.days))}
						class="btn btn-sm {followUpDate === dateFromToday(preset.days)
							? 'preset-tonal-primary'
							: 'preset-outlined-surface-500'}"
					>
						{preset.label}
					</button>
				{/each}
				<button
					type="button"
					onclick={() => (followUpDate = '')}
					class="btn btn-sm {followUpDate === ''
						? 'preset-tonal-primary'
						: 'preset-outlined-surface-500'}"
				>
					Clear
				</button>
			</div>
		</div>

		<!-- Is closed -->
		<label class="flex items-center gap-2 self-end py-2">
			<input
				type="checkbox"
				name="is_closed"
				class="checkbox"
				checked={denial.is_closed}
				value="true"
			/>
			<span class="text-sm font-medium">Closed</span>
		</label>
	</div>

	<!-- Insurances combobox -->
	{#if insurances.length}
		<div>
			<InsuranceCombobox {insurances} selected={currentInsuranceIds} />
		</div>
	{/if}

	<!-- Labels pill select -->
	{#if labels.length}
		<div>
			<LabelPillSelect {labels} selected={currentLabelIds} />
		</div>
	{/if}

	<!-- Actions -->
	<div class="flex gap-2 pt-2">
		<button type="submit" class="btn preset-filled-primary-500">Save</button>
		<button type="button" class="btn preset-outlined-surface-500" onclick={oncancel}>
			Cancel
		</button>
	</div>
</form>
