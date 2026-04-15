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

	function toInputDate(dateStr: string | null): string {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		if (isNaN(d.getTime())) return '';
		return d.toISOString().slice(0, 10);
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
		<label class="label">
			<span class="label-text text-sm font-medium">Follow-up Date</span>
			<input
				type="date"
				name="follow_up_date"
				class="input"
				value={toInputDate(denial.follow_up_date)}
			/>
		</label>

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
		<button type="submit" class="btn preset-filled-primary-500 btn-sm">Save</button>
		<button type="button" class="btn preset-outlined-surface-500 btn-sm" onclick={oncancel}>
			Cancel
		</button>
	</div>
</form>
