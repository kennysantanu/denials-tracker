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
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';

	let { data } = $props();

	let openDenials = $derived(
		data.denials.filter((d: (typeof data.denials)[number]) => !d.is_closed)
	);
	let closedDenials = $derived(
		data.denials.filter((d: (typeof data.denials)[number]) => d.is_closed)
	);

	let showClosed = $state(false);
	let showNewDenialForm = $state(false);
	let newDenialFollowUpDate = $state('');

	function dateFromToday(days: number): string {
		const d = new Date();
		d.setDate(d.getDate() + days);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}
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
	let patientNoteEditor = $state<ReturnType<typeof NoteEditor>>();
	let patientMenuOpen = $state(false);

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
		// Path format: patients/{patientId}/{filename}
		const last = fileName.split('/').pop() ?? fileName;
		const match = last.match(/^\d+_(.+)$/);
		return match ? match[1] : last;
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
				patient: {
					id: data.patient.id,
					first_name: data.patient.first_name,
					last_name: data.patient.last_name,
					date_of_birth: data.patient.date_of_birth,
					note: data.patient.note,
					created_at: data.patient.created_at
				},
				files: (data.patientFiles ?? []).map((f: any) => ({
					name: f.name,
					mimetype: f.mimetype,
					size: f.size,
					created_at: f.created_at
				})),
				denials: data.denials
					.map((d: (typeof data.denials)[number]) => ({
						id: d.id,
						service_start_date: d.service_start_date,
						is_closed: d.is_closed
					}))
					.sort((a: any, b: any) =>
						(b.service_start_date ?? '').localeCompare(a.service_start_date ?? '')
					)
					.slice(0, 50)
			}
		});
	});
</script>

<svelte:head>
	<title>{data.patient.last_name}, {data.patient.first_name} | Denials Tracker</title>
</svelte:head>

<div class="mx-auto max-w-5xl">
	<!-- Breadcrumb -->
	<nav class="mb-4 flex items-center gap-1.5 text-sm text-surface-500" aria-label="Breadcrumb">
		<a href="/record" class="hover:text-primary-600 hover:underline">Records</a>
		<span>/</span>
		<span class="font-medium text-surface-800"
			>{data.patient.last_name}, {data.patient.first_name}</span
		>
	</nav>

	<!-- Patient Header -->
	<div class="mb-8 card border border-surface-200 bg-surface-50 p-6">
		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0 flex-1">
				<h1 class="text-2xl font-bold tracking-tight text-surface-900">
					{data.patient.last_name}, {data.patient.first_name} ({formatDate(
						data.patient.date_of_birth
					)})
				</h1>
				{#if editingNote}
					<form
						method="POST"
						action="?/updatePatientNote"
						enctype="multipart/form-data"
						class="mt-3 space-y-3"
						use:enhance={() => {
							return async ({ result, update }) => {
								if (result.type === 'success') {
									toastSuccess('Patient updated');
									editingNote = false;
									patientNoteEditor?.reset();
									await update();
								} else if (result.type === 'failure') {
									toastError('Error', String(result.data?.error ?? 'Failed to update'));
									await update({ reset: false });
								}
							};
						}}
					>
						<NoteEditor
							bind:this={patientNoteEditor}
							bind:value={noteText}
							placeholder="Patient note…"
							attachedFiles={data.patientFiles as any}
							showUpload={data.effectivePermissions['file.upload']}
							allowExistingFiles={false}
						/>
						<div class="flex gap-2">
							<button type="submit" class="btn preset-filled-primary-500 btn-sm">Save</button>
							<button
								type="button"
								class="btn preset-outlined-surface-500 btn-sm"
								onclick={() => {
									editingNote = false;
									noteText = data.patient.note ?? '';
									patientNoteEditor?.reset();
								}}>Cancel</button
							>
						</div>
					</form>
				{:else if data.patient.note}
					<div class="prose prose-sm mt-2 max-w-none">{@html renderedPatientNote}</div>
				{/if}
			</div>

			<!-- Kebab menu -->
			{#if data.effectivePermissions['patient.update'] || data.effectivePermissions['file.upload'] || data.effectivePermissions['file.delete']}
				<div class="relative shrink-0">
					<button
						type="button"
						class="btn preset-outlined-surface-500 btn-sm px-1.5"
						title="Patient actions"
						onclick={() => (patientMenuOpen = !patientMenuOpen)}
					>
						⋮
					</button>
					{#if patientMenuOpen}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="absolute right-0 z-10 mt-1 min-w-36 rounded-container border border-surface-200 bg-white py-1 shadow-lg"
							onmouseleave={() => (patientMenuOpen = false)}
						>
							<button
								type="button"
								class="w-full px-4 py-2 text-left text-sm hover:bg-surface-100"
								onclick={() => {
									noteText = data.patient.note ?? '';
									editingNote = true;
									patientMenuOpen = false;
								}}
							>
								Edit
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Patient Files Panel: only shown when files exist -->
		{#if data.patientFiles.length > 0}
			<div class="mt-4 border-t border-surface-200 pt-3">
				<div class="flex flex-wrap items-center gap-1.5">
					<span class="text-xs font-medium text-surface-500">Files:</span>
					{#each data.patientFiles as file (file.name)}
						<a
							href="/file/view?name={encodeURIComponent(file.name)}"
							class="inline-flex items-center gap-1.5 rounded-base border border-surface-200 bg-surface-50 px-2.5 py-1 text-xs text-primary-600 transition-colors hover:bg-surface-100 hover:text-primary-800"
							title={file.name}
						>
							<span class="max-w-37.5 truncate">{displayFileName(file.name)}</span>
						</a>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- Filters -->
	<div class="mb-4 flex flex-wrap items-center gap-2 lg:flex-nowrap">
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
			class="input min-w-24 flex-1"
		/>
		{#if isFiltering}
			<button
				type="button"
				class="btn shrink-0 btn-sm hover:preset-tonal"
				onclick={() => {
					searchQuery = '';
					filterLabelIds = [];
					filterInsuranceIds = [];
					filterServiceDates = [];
				}}
			>
				<X class="h-4 w-4" />
				Clear
			</button>
		{/if}
	</div>

	<!-- Open Denials -->
	<section class="mb-8">
		<div class="mb-4 flex items-center justify-between">
			{#if !showNewDenialForm}
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
			{:else}
				<span></span>
			{/if}
			{#if data.effectivePermissions['denial.create']}
				<button
					type="button"
					class="btn {showNewDenialForm ? 'preset-tonal' : 'preset-filled-primary-500'}"
					onclick={() => {
						showNewDenialForm = !showNewDenialForm;
						if (showNewDenialForm) newDenialFollowUpDate = '';
					}}
			>
				{#if showNewDenialForm}
					<X class="h-4 w-4" />
					Cancel
				{:else}
					<Plus class="h-4 w-4" />
					New Denial
				{/if}
			</button>
			{/if}
		</div>

		{#if showNewDenialForm}
			<div class="mb-4 card border border-surface-200 bg-white p-6 shadow-sm">
				<form
					method="POST"
					action="?/createDenial"
					enctype="multipart/form-data"
					use:enhance={() => {
						return async ({ result, update }) => {
							if (result.type === 'success') {
								toastSuccess('Denial created');
								showNewDenialForm = false;
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
							<label for="inline_service_start_date" class="mb-1 block text-sm font-medium">
								Service Start Date <span class="text-error-500">*</span>
							</label>
							<input
								type="date"
								id="inline_service_start_date"
								name="service_start_date"
								required
								class="input"
							/>
						</div>
						<div>
							<label for="inline_service_end_date" class="mb-1 block text-sm font-medium">
								Service End Date
							</label>
							<input
								type="date"
								id="inline_service_end_date"
								name="service_end_date"
								class="input"
							/>
						</div>
						<div>
							<label for="inline_billed_amount" class="mb-1 block text-sm font-medium">
								Billed Amount
							</label>
							<div class="relative">
								<span
									class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-surface-400"
									>$</span
								>
								<input
									type="number"
									id="inline_billed_amount"
									name="billed_amount"
									step="0.01"
									min="0"
									placeholder="0.00"
									class="input pl-7"
								/>
							</div>
						</div>
						<div>
							<label for="inline_paid_amount" class="mb-1 block text-sm font-medium">
								Paid Amount
							</label>
							<div class="relative">
								<span
									class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-surface-400"
									>$</span
								>
								<input
									type="number"
									id="inline_paid_amount"
									name="paid_amount"
									step="0.01"
									min="0"
									placeholder="0.00"
									class="input pl-7"
								/>
							</div>
						</div>
						<div>
							<label for="inline_follow_up_date" class="mb-1 block text-sm font-medium">
								Follow-up Date
							</label>
							<input
								type="date"
								id="inline_follow_up_date"
								name="follow_up_date"
								bind:value={newDenialFollowUpDate}
								class="input"
							/>
							<div class="mt-1.5 flex flex-wrap gap-1">
								{#each [{ label: '2 wks', days: 14 }, { label: '30 days', days: 30 }, { label: '60 days', days: 60 }, { label: '90 days', days: 90 }] as preset (preset.days)}
									<button
										type="button"
										onclick={() => (newDenialFollowUpDate = dateFromToday(preset.days))}
										class="btn btn-sm {newDenialFollowUpDate === dateFromToday(preset.days)
											? 'preset-tonal-primary'
											: 'preset-outlined-surface-500'}"
									>
										{preset.label}
									</button>
								{/each}
							</div>
						</div>
						<div class="flex items-center gap-2 self-end py-2">
							<input
								type="checkbox"
								id="inline_is_closed"
								name="is_closed"
								value="true"
								class="rounded border-surface-300"
							/>
							<label for="inline_is_closed" class="text-sm font-medium">Closed</label>
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
						<button type="submit" class="btn preset-filled-primary-500"> Create Denial </button>
						<button
							type="button"
							class="btn preset-outlined-surface-500"
							onclick={() => (showNewDenialForm = false)}
						>
							Cancel
						</button>
					</div>
				</form>
			</div>
		{/if}

		{#if showNewDenialForm}
			<h2 class="mb-4 text-xl font-semibold">
				Open Claims
				{#if isFiltering}
					<span class="text-base font-normal text-surface-400"
						>({filteredOpenDenials.length} of {openDenials.length})</span
					>
				{:else}
					<span class="text-base font-normal text-surface-400">({openDenials.length})</span>
				{/if}
			</h2>
		{/if}

		{#if filteredOpenDenials.length > 0}
			<div class="space-y-4">
				{#each filteredOpenDenials as denial (denial.id)}
					<DenialCard
						{denial}
						patientId={data.patient.id}
						insurances={data.allInsurances}
						labels={data.allLabels}
						effectivePermissions={data.effectivePermissions}
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
						effectivePermissions={data.effectivePermissions}
						{searchQuery}
					/>
				{/each}
			</div>
		{:else if showClosed}
			<p class="text-surface-500">No closed claims.</p>
		{/if}
	</section>
</div>
