<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { toastSuccess, toastError } from '$lib/toast';
	import { formatDate } from '$lib/utils';
	import { marked } from 'marked';
	import DenialCard from '$lib/components/denial/DenialCard.svelte';
	import {
		InsuranceCombobox,
		LabelPillSelect,
		NoteEditor,
		MultiSelectDropdown
	} from '$lib/components/ui';
	import { setChatContext } from '$lib/stores/chatContext.svelte';

	let { data } = $props();

	let openDenials = $derived(
		data.denials.filter((d: (typeof data.denials)[number]) => !d.is_closed)
	);
	let closedDenials = $derived(
		data.denials.filter((d: (typeof data.denials)[number]) => d.is_closed)
	);

	let showClosed = $state(false);
	let showNewDenialModal = $state(false);
	let newDenialFollowUpDate = $state('');

	function dateFromToday(days: number): string {
		const d = new Date();
		d.setDate(d.getDate() + days);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}
	let uploading = $state(false);
	let fileInput = $state<HTMLInputElement>();
	let editingNote = $state(false);
	let noteText = $state('');
	$effect(() => {
		if (!editingNote) noteText = data.patient.note ?? '';
	});
	let searchQuery = $state('');
	let filterLabelIds = $state<number[]>([]);
	let filterInsuranceIds = $state<number[]>([]);
	let filterServiceDates = $state<string[]>([]);

	let noteEditor = $state<ReturnType<typeof NoteEditor>>();
	let confirmingFile = $state<string | null>(null);

	function autoresize(node: HTMLTextAreaElement) {
		function resize() {
			node.style.height = 'auto';
			node.style.height = node.scrollHeight + 'px';
		}
		node.addEventListener('input', resize);
		resize();
		return {
			destroy() {
				node.removeEventListener('input', resize);
			}
		};
	}

	function renderPatientNote(text: string): string {
		const raw = marked.parse(text);
		if (typeof raw !== 'string') return '';
		// Sanitize dangerous URL schemes (SSR-safe XSS prevention)
		return raw.replace(/(href|src)="(javascript:|data:)[^"]*"/gi, '$1="#"');
	}

	let renderedPatientNote = $derived(data.patient.note ? renderPatientNote(data.patient.note) : '');

	function displayFileName(fileName: string): string {
		// Path format: patients/{ptid}/{timestamp}_{originalName}
		const last = fileName.split('/').pop() ?? fileName;
		const match = last.match(/^\d+_(.+)$/);
		return match ? match[1] : last;
	}

	function formatBytes(bytes: number | null): string {
		if (!bytes) return '';
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
	}

	function matchesDenial(denial: (typeof data.denials)[number]): boolean {
		const q = searchQuery.toLowerCase().trim();
		if (q) {
			const inNote = denial.notes?.some((n) => (n.note ?? '').toLowerCase().includes(q));
			if (!inNote) return false;
		}
		if (filterLabelIds.length > 0 && !denial.labels?.some((l) => filterLabelIds.includes(l.id)))
			return false;
		if (
			filterInsuranceIds.length > 0 &&
			!denial.insurances?.some((ins) => filterInsuranceIds.includes(ins.id))
		)
			return false;
		if (
			filterServiceDates.length > 0 &&
			!filterServiceDates.includes(denial.service_start_date ?? '')
		)
			return false;
		return true;
	}

	let filteredOpenDenials = $derived(openDenials.filter(matchesDenial));
	let filteredClosedDenials = $derived(closedDenials.filter(matchesDenial));
	let isFiltering = $derived(
		searchQuery.trim().length > 0 ||
			filterLabelIds.length > 0 ||
			filterInsuranceIds.length > 0 ||
			filterServiceDates.length > 0
	);

	// Only show labels/insurances that exist on this patient's denials
	let usedLabels = $derived(
		[
			...new Map(
				data.denials
					.flatMap((d: (typeof data.denials)[number]) => d.labels ?? [])
					.map(
						(l: {
							id: number;
							label_name: string;
							bg_color: string;
							txt_color: string;
							order: number | null;
						}) => [l.id, l]
					)
			).values()
		].sort(
			(a: { order: number | null }, b: { order: number | null }) =>
				(a.order ?? Infinity) - (b.order ?? Infinity)
		)
	);
	let usedInsurances = $derived(
		[
			...new Map(
				data.denials
					.flatMap((d: (typeof data.denials)[number]) => d.insurances ?? [])
					.map((ins: { id: number; name: string }) => [ins.id, ins])
			).values()
		].sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))
	);
	let usedServiceDates = $derived(
		[
			...new Set(
				data.denials.map((d: (typeof data.denials)[number]) => d.service_start_date).filter(Boolean)
			)
		]
			.sort()
			.reverse()
			.map((date: string) => ({ value: date, label: formatDate(date) }))
	);

	// Set AI chat context for this patient
	$effect(() => {
		setChatContext({
			route: `/record/${data.patient.id}`,
			patientId: data.patient.id,
			pageData: {
				patientName: `${data.patient.first_name} ${data.patient.last_name}`,
				openDenialCount: openDenials.length,
				closedDenialCount: closedDenials.length
			}
		});
	});
</script>

<svelte:head>
	<title>{data.patient.last_name}, {data.patient.first_name} — Denials Tracker</title>
</svelte:head>

<div class="mx-auto max-w-5xl p-6">
	<!-- Breadcrumb -->
	<nav class="mb-4 flex items-center gap-1.5 text-sm text-surface-500" aria-label="Breadcrumb">
		<a href="/record" class="hover:text-primary-600 hover:underline">Records</a>
		<span>/</span>
		<span class="font-medium text-surface-800"
			>{data.patient.last_name}, {data.patient.first_name}</span
		>
	</nav>

	<!-- Patient Header -->
	<div class="mb-8 rounded-lg border border-surface-200 bg-surface-50 p-6">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div class="min-w-0 flex-1">
				<h1 class="text-2xl font-bold">
					{data.patient.last_name}, {data.patient.first_name}
				</h1>
				<p class="mt-1 text-surface-500">
					DOB: {formatDate(data.patient.date_of_birth)}
				</p>
				{#if editingNote}
					<form
						method="POST"
						action="?/updatePatientNote"
						class="mt-2"
						use:enhance={() => {
							return async ({ result, update }) => {
								if (result.type === 'success') {
									toastSuccess('Note updated');
									editingNote = false;
									await update();
								} else if (result.type === 'failure') {
									toastError('Error', String(result.data?.error ?? 'Failed to update'));
								}
							};
						}}
					>
						<textarea
							name="note"
							rows="1"
							class="w-full resize-none overflow-hidden rounded border border-surface-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
							placeholder="Patient note…"
							bind:value={noteText}
							use:autoresize
						></textarea>
						<div class="mt-1.5 flex gap-2">
							<button
								type="submit"
								class="rounded bg-primary-600 px-3 py-1 text-xs text-white hover:bg-primary-700"
								>Save</button
							>
							<button
								type="button"
								class="rounded border border-surface-300 px-3 py-1 text-xs text-surface-600 hover:bg-surface-100"
								onclick={() => {
									editingNote = false;
									noteText = data.patient.note ?? '';
								}}>Cancel</button
							>
						</div>
					</form>
				{:else}
					{#if data.patient.note}
						<div class="prose prose-sm mt-2 max-w-none">{@html renderedPatientNote}</div>
					{/if}
					{#if data.permissions['manage_patients']}
						<button
							type="button"
							class="mt-1.5 text-xs text-surface-400 hover:text-primary-600"
							onclick={() => {
								noteText = data.patient.note ?? '';
								editingNote = true;
							}}
						>
							{data.patient.note ? 'Edit note' : '+ Add note'}
						</button>
					{/if}
				{/if}
			</div>
		</div>

		<!-- Patient Files Panel -->
		{#if data.patientFiles.length > 0 || data.permissions['file_upload']}
			<div class="mt-4 border-t border-surface-200 pt-3">
				<div class="flex flex-wrap items-center gap-1.5">
					<span class="text-xs font-medium text-surface-500">Files:</span>

					{#each data.patientFiles as file (file.name)}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2.5 py-1 text-xs text-surface-700"
						>
							<a
								href="/file/view?name={encodeURIComponent(file.name)}"
								class="text-primary-600 hover:underline"
								title={formatBytes(file.size) || undefined}
							>
								{displayFileName(file.name)}
							</a>
							{#if file.size}
								<span class="text-surface-400">{formatBytes(file.size)}</span>
							{/if}
							{#if data.permissions['file_delete']}
								{#if confirmingFile === file.name}
									<span class="ml-0.5 inline-flex items-center gap-1">
										<span class="text-surface-500">Remove?</span>
										<form
											method="POST"
											action="?/removePatientFile"
											use:enhance={() => {
												return async ({ result, update }) => {
													confirmingFile = null;
													if (result.type === 'success') {
														toastSuccess('File removed');
														await update();
													} else if (result.type === 'failure') {
														toastError('Error', String(result.data?.error ?? 'Failed to remove'));
													}
												};
											}}
										>
											<input type="hidden" name="file_name" value={file.name} />
											<button type="submit" class="font-medium text-red-600 hover:text-red-800"
												>Yes</button
											>
										</form>
										<button
											type="button"
											class="text-surface-500 hover:text-surface-700"
											onclick={() => (confirmingFile = null)}>No</button
										>
									</span>
								{:else}
									<button
										type="button"
										class="ml-0.5 text-surface-400 hover:text-red-600"
										title="Remove"
										onclick={() => (confirmingFile = file.name)}>✕</button
									>
								{/if}
							{/if}
						</span>
					{/each}

					{#if data.permissions['file_upload']}
						<form
							method="POST"
							action="?/uploadPatientFile"
							enctype="multipart/form-data"
							use:enhance={() => {
								uploading = true;
								return async ({ result, update }) => {
									uploading = false;
									if (result.type === 'success') {
										toastSuccess('File uploaded');
										if (fileInput) fileInput.value = '';
										await update();
									} else if (result.type === 'failure') {
										toastError('Upload failed', String(result.data?.error ?? 'Unknown error'));
									}
								};
							}}
						>
							<label
								class="inline-flex cursor-pointer items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-100"
							>
								{#if uploading}
									Uploading…
								{:else}
									+ Attach
								{/if}
								<input
									bind:this={fileInput}
									type="file"
									name="files"
									accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv"
									multiple
									class="hidden"
									disabled={uploading}
									onchange={(e) => {
										const form = (e.target as HTMLInputElement).closest('form');
										if (form) form.requestSubmit();
									}}
								/>
							</label>
						</form>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<!-- Filters -->
	<div class="mb-4 flex flex-wrap items-center gap-2">
		{#if usedServiceDates.length > 0}
			<MultiSelectDropdown
				options={usedServiceDates}
				bind:selected={filterServiceDates}
				placeholder="All service dates"
			/>
		{/if}
		{#if usedLabels.length > 0}
			<MultiSelectDropdown
				options={usedLabels.map((l) => ({
					value: l.id,
					label: l.label_name,
					bgColor: l.bg_color,
					txtColor: l.txt_color
				}))}
				bind:selected={filterLabelIds}
				placeholder="All labels"
			/>
		{/if}
		{#if usedInsurances.length > 0}
			<MultiSelectDropdown
				options={usedInsurances.map((ins) => ({ value: ins.id, label: ins.name }))}
				bind:selected={filterInsuranceIds}
				placeholder="All insurances"
			/>
		{/if}
		<input
			type="search"
			placeholder="Search notes…"
			bind:value={searchQuery}
			class="rounded border border-surface-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
		/>
		{#if isFiltering}
			<button
				type="button"
				class="text-xs text-surface-400 hover:text-surface-700"
				onclick={() => {
					searchQuery = '';
					filterLabelIds = [];
					filterInsuranceIds = [];
					filterServiceDates = [];
				}}
			>
				✕ Clear
			</button>
		{/if}
	</div>

	<!-- Open Denials -->
	<section class="mb-8">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold">
				Open Claims
				{#if isFiltering}
					<span class="text-base font-normal text-surface-400"
						>({filteredOpenDenials.length} of {openDenials.length})</span
					>
				{:else}
					<span class="text-base font-normal text-surface-400">({openDenials.length})</span>
				{/if}
			</h2>
			{#if data.permissions['create_denial']}
				<button
					type="button"
					class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
					onclick={() => {
						showNewDenialModal = true;
						newDenialFollowUpDate = '';
					}}
				>
					+ New Denial
				</button>
			{/if}
		</div>

		{#if filteredOpenDenials.length > 0}
			<div class="space-y-4">
				{#each filteredOpenDenials as denial (denial.id)}
					<DenialCard
						{denial}
						patientId={data.patient.id}
						insurances={data.allInsurances}
						labels={data.allLabels}
						permissions={data.permissions}
						aiEnabled={data.aiEnabled}
						{searchQuery}
					/>
				{/each}
			</div>
		{:else if isFiltering}
			<p class="text-surface-500">No open claims match your filters.</p>
		{:else}
			<p class="text-surface-500">No open claims.</p>
		{/if}
	</section>

	<!-- Closed Denials -->
	<section>
		<button
			type="button"
			class="mb-4 flex items-center gap-2 text-lg font-semibold text-surface-600 hover:text-surface-800"
			onclick={() => (showClosed = !showClosed)}
		>
			<span class="inline-block transition-transform" class:rotate-90={showClosed}>▶</span>
			Closed Claims
			{#if isFiltering}
				<span class="text-base font-normal text-surface-400"
					>({filteredClosedDenials.length} of {closedDenials.length})</span
				>
			{:else}
				<span class="text-base font-normal text-surface-400">({closedDenials.length})</span>
			{/if}
		</button>

		{#if showClosed && closedDenials.length > 0}
			<div class="space-y-4">
				{#each filteredClosedDenials as denial (denial.id)}
					<DenialCard
						{denial}
						patientId={data.patient.id}
						insurances={data.allInsurances}
						labels={data.allLabels}
						permissions={data.permissions}
						aiEnabled={data.aiEnabled}
						{searchQuery}
					/>
				{/each}
			</div>
		{:else if showClosed}
			<p class="text-surface-500">No closed claims.</p>
		{/if}
	</section>
</div>

<!-- New Denial Modal -->
{#if showNewDenialModal}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
		onkeydown={(e) => e.key === 'Escape' && (showNewDenialModal = false)}
		onclick={(e) => {
			if (e.target === e.currentTarget) showNewDenialModal = false;
		}}
	>
		<div
			class="my-8 w-full max-w-2xl rounded-lg bg-white shadow-xl"
			role="dialog"
			aria-modal="true"
			aria-label="New Denial"
		>
			<div class="flex items-center justify-between border-b border-surface-200 px-6 py-4">
				<h3 class="text-lg font-semibold">New Denial</h3>
				<button
					type="button"
					class="text-surface-400 hover:text-surface-700"
					onclick={() => (showNewDenialModal = false)}
					aria-label="Close"
				>
					✕
				</button>
			</div>
			<div class="px-6 py-5">
				<form
					method="POST"
					action="?/createDenial"
					enctype="multipart/form-data"
					use:enhance={() => {
						return async ({ result, update }) => {
							if (result.type === 'success') {
								toastSuccess('Denial created');
								showNewDenialModal = false;
								noteEditor?.reset();
								await update();
							} else if (result.type === 'failure') {
								toastError('Error', String(result.data?.error ?? 'Failed to create denial'));
							}
						};
					}}
				>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label for="modal_service_start_date" class="mb-1 block text-sm font-medium">
								Service Start Date <span class="text-red-500">*</span>
							</label>
							<input
								type="date"
								id="modal_service_start_date"
								name="service_start_date"
								required
								class="w-full rounded border border-surface-300 px-3 py-2"
							/>
						</div>
						<div>
							<label for="modal_service_end_date" class="mb-1 block text-sm font-medium">
								Service End Date
							</label>
							<input
								type="date"
								id="modal_service_end_date"
								name="service_end_date"
								class="w-full rounded border border-surface-300 px-3 py-2"
							/>
						</div>
						<div>
							<label for="modal_billed_amount" class="mb-1 block text-sm font-medium">
								Billed Amount
							</label>
							<div class="relative">
								<span
									class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-surface-400"
									>$</span
								>
								<input
									type="number"
									id="modal_billed_amount"
									name="billed_amount"
									step="0.01"
									min="0"
									placeholder="0.00"
									class="w-full rounded border border-surface-300 py-2 pr-3 pl-7"
								/>
							</div>
						</div>
						<div>
							<label for="modal_paid_amount" class="mb-1 block text-sm font-medium">
								Paid Amount
							</label>
							<div class="relative">
								<span
									class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-surface-400"
									>$</span
								>
								<input
									type="number"
									id="modal_paid_amount"
									name="paid_amount"
									step="0.01"
									min="0"
									placeholder="0.00"
									class="w-full rounded border border-surface-300 py-2 pr-3 pl-7"
								/>
							</div>
						</div>
						<div>
							<label for="modal_follow_up_date" class="mb-1 block text-sm font-medium">
								Follow-up Date
							</label>
							<input
								type="date"
								id="modal_follow_up_date"
								name="follow_up_date"
								bind:value={newDenialFollowUpDate}
								class="w-full rounded border border-surface-300 px-3 py-2"
							/>
							<div class="mt-1.5 flex flex-wrap gap-1">
								{#each [{ label: '2 wks', days: 14 }, { label: '30 days', days: 30 }, { label: '60 days', days: 60 }, { label: '90 days', days: 90 }] as preset (preset.days)}
									<button
										type="button"
										onclick={() => (newDenialFollowUpDate = dateFromToday(preset.days))}
										class="rounded-full border border-surface-300 px-2.5 py-0.5 text-xs font-medium text-surface-600 transition-colors hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 {newDenialFollowUpDate ===
										dateFromToday(preset.days)
											? 'border-primary-500 bg-primary-50 text-primary-700'
											: ''}"
									>
										{preset.label}
									</button>
								{/each}
							</div>
						</div>
						<div class="flex items-center gap-2 self-end py-2">
							<input
								type="checkbox"
								id="modal_is_closed"
								name="is_closed"
								value="true"
								class="rounded border-surface-300"
							/>
							<label for="modal_is_closed" class="text-sm font-medium">Closed</label>
						</div>
					</div>

					<!-- Insurance Combobox -->
					{#if data.allInsurances.length > 0}
						<div class="mt-4">
							<InsuranceCombobox insurances={data.allInsurances} />
						</div>
					{/if}

					<!-- Label Pills -->
					{#if data.allLabels.length > 0}
						<div class="mt-4">
							<LabelPillSelect labels={data.allLabels} />
						</div>
					{/if}

					<!-- Initial Note + Attachments -->
					<div class="mt-4">
						<NoteEditor
							bind:this={noteEditor}
							name="initial_note"
							required
							placeholder="Enter denial reason or initial notes…"
						/>
					</div>

					<div class="mt-6 flex gap-2">
						<button
							type="submit"
							class="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
						>
							Create Denial
						</button>
						<button
							type="button"
							class="rounded-lg border border-surface-300 px-6 py-2 text-sm font-medium text-surface-600 transition-colors hover:bg-surface-100"
							onclick={() => (showNewDenialModal = false)}
						>
							Cancel
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}
