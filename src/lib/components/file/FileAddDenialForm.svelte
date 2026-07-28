<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toastSuccess, toastError } from '$lib/toast';
	import { formatDate } from '$lib/utils';

	interface PatientMatch {
		id: number;
		first_name: string;
		last_name: string;
		date_of_birth: string | null;
	}

	interface PatientDenialSummary {
		id: number;
		service_start_date: string;
		service_end_date: string | null;
		is_closed: boolean;
	}

	interface Props {
		fileName: string;
		canCreateDenial: boolean;
		canCreatePatient: boolean;
		canCreateNote: boolean;
	}

	let { fileName, canCreateDenial, canCreatePatient, canCreateNote }: Props = $props();

	type Mode = 'search' | 'newPatient' | 'details';

	let open = $state(false);
	let mode = $state<Mode>('search');
	let selectedPatient = $state<PatientMatch | null>(null);
	let patientDenials = $state<PatientDenialSummary[]>([]);
	let loadingDenials = $state(false);
	let denialsError = $state('');
	let denialsAbortController: AbortController | null = null;
	let selectedDenial = $state<PatientDenialSummary | null>(null);

	// Patient search
	let searchQuery = $state('');
	let searchResults = $state<PatientMatch[]>([]);
	let searching = $state(false);
	let searchTimer: ReturnType<typeof setTimeout>;

	function runSearch() {
		clearTimeout(searchTimer);
		const q = searchQuery.trim();
		if (!q) {
			searchResults = [];
			searching = false;
			return;
		}
		searching = true;
		searchTimer = setTimeout(async () => {
			try {
				const res = await fetch(`/api/v1/patients?q=${encodeURIComponent(q)}`);
				if (res.ok) {
					const body = await res.json();
					searchResults = body.patients ?? [];
				}
			} finally {
				searching = false;
			}
		}, 300);
	}

	async function loadPatientDenials(patientId: number) {
		denialsAbortController?.abort();
		const controller = new AbortController();
		denialsAbortController = controller;
		loadingDenials = true;
		denialsError = '';
		patientDenials = [];

		try {
			const res = await fetch(`/api/v1/patients/${patientId}/denials`, {
				signal: controller.signal
			});
			if (!res.ok) {
				throw new Error('Could not load existing denials');
			}
			const body = await res.json();
			if (denialsAbortController === controller) {
				patientDenials = body.denials ?? [];
			}
		} catch {
			if (!controller.signal.aborted && denialsAbortController === controller) {
				denialsError = 'Could not load existing denials.';
			}
		} finally {
			if (denialsAbortController === controller) {
				loadingDenials = false;
			}
		}
	}

	function selectPatient(patient: PatientMatch) {
		selectedPatient = patient;
		mode = 'details';
		void loadPatientDenials(patient.id);
	}

	function changePatient() {
		denialsAbortController?.abort();
		denialsAbortController = null;
		selectedPatient = null;
		patientDenials = [];
		selectedDenial = null;
		loadingDenials = false;
		denialsError = '';
		mode = 'search';
	}

	function retryPatientDenials() {
		if (selectedPatient) {
			void loadPatientDenials(selectedPatient.id);
		}
	}

	function selectDenialForNote(denial: PatientDenialSummary) {
		selectedDenial = denial;
		existingNote = '';
	}

	function cancelExistingNote() {
		selectedDenial = null;
		existingNote = '';
	}

	// New patient quick-create
	let newDob = $state('');
	let newLastName = $state('');
	let newFirstName = $state('');
	let newNote = $state('');
	let creatingPatient = $state(false);

	// Denial details
	let serviceStartDate = $state('');
	let serviceEndDate = $state('');
	let note = $state('');
	let submitting = $state(false);
	let existingNote = $state('');
	let submittingNote = $state(false);
	let exactDuplicate = $derived(
		serviceStartDate
			? (patientDenials.find(
					(denial) =>
						denial.service_start_date === serviceStartDate &&
						(denial.service_end_date ?? '') === serviceEndDate
				) ?? null)
			: null
	);

	function resetAll() {
		denialsAbortController?.abort();
		denialsAbortController = null;
		open = false;
		mode = 'search';
		selectedPatient = null;
		patientDenials = [];
		selectedDenial = null;
		loadingDenials = false;
		denialsError = '';
		searchQuery = '';
		searchResults = [];
		newDob = '';
		newLastName = '';
		newFirstName = '';
		newNote = '';
		serviceStartDate = '';
		serviceEndDate = '';
		note = '';
		existingNote = '';
		submittingNote = false;
	}
</script>

{#if canCreateDenial || canCreateNote}
	<div class="@container card border border-surface-200 bg-white py-3">
		{#if !open}
			<div class="p-3">
				<button
					type="button"
					class="btn w-full preset-outlined-primary-500 btn-sm"
					onclick={() => (open = true)}
				>
					{canCreateDenial && canCreateNote
						? '+ Add Denial or Note'
						: canCreateDenial
							? '+ New Denial'
							: '+ Add Note'}
				</button>
			</div>
		{:else}
			<div class="space-y-3 p-4">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-semibold text-surface-600">
						{selectedDenial ? 'Add Note' : canCreateDenial ? 'New Denial' : 'Add Note'}
					</h2>
					<button
						type="button"
						class="text-surface-400 hover:text-surface-700"
						onclick={resetAll}
						aria-label="Cancel add denial"
					>
						✕
					</button>
				</div>

				{#if mode === 'search'}
					<div class="space-y-2">
						<label class="label">
							<span class="label-text text-xs">Search by last name, first name, or DOB</span>
							<input
								type="text"
								class="input"
								bind:value={searchQuery}
								oninput={runSearch}
								autocomplete="off"
								placeholder="e.g. Smith or 1990-01-01"
							/>
						</label>
						{#if searching}
							<p class="text-xs text-surface-500">Searching…</p>
						{:else if searchResults.length > 0}
							<ul class="max-h-48 space-y-1 overflow-y-auto">
								{#each searchResults as patient (patient.id)}
									<li>
										<button
											type="button"
											class="w-full rounded-base px-2 py-1.5 text-left text-sm hover:bg-surface-100"
											onclick={() => selectPatient(patient)}
										>
											{patient.last_name}, {patient.first_name}
											{#if patient.date_of_birth}
												<span class="text-surface-500">
													({formatDate(patient.date_of_birth)})
												</span>
											{/if}
										</button>
									</li>
								{/each}
							</ul>
						{:else if searchQuery.trim()}
							<p class="text-xs text-surface-500">No matches.</p>
						{/if}
						{#if canCreatePatient && canCreateDenial}
							<button
								type="button"
								class="text-xs text-primary-600 hover:underline"
								onclick={() => (mode = 'newPatient')}
							>
								Can't find them? + New patient
							</button>
						{/if}
					</div>
				{:else if mode === 'newPatient'}
					<form
						method="POST"
						action="/record?/createPatient"
						use:enhance={() => {
							creatingPatient = true;
							return async ({ result }) => {
								creatingPatient = false;
								if (result.type === 'redirect') {
									const match = result.location.match(/^\/record\/(\d+)$/);
									const id = match ? Number(match[1]) : null;
									if (id) {
										selectedPatient = {
											id,
											first_name: newFirstName.trim(),
											last_name: newLastName.trim(),
											date_of_birth: newDob || null
										};
										mode = 'details';
										toastSuccess('Patient created');
									} else {
										toastError('Could not determine the new patient');
									}
								} else if (result.type === 'failure') {
									toastError(
										(result.data as Record<string, string>)?.error || 'Failed to create patient'
									);
								}
							};
						}}
						class="space-y-2"
					>
						<label class="label">
							<span class="label-text text-xs">Date of birth</span>
							<input type="date" name="date_of_birth" required class="input" bind:value={newDob} />
						</label>
						<label class="label">
							<span class="label-text text-xs">Last name</span>
							<input type="text" name="last_name" required class="input" bind:value={newLastName} />
						</label>
						<label class="label">
							<span class="label-text text-xs">First name</span>
							<input
								type="text"
								name="first_name"
								required
								class="input"
								bind:value={newFirstName}
							/>
						</label>
						<label class="label">
							<span class="label-text text-xs">Note</span>
							<input type="text" name="note" class="input" bind:value={newNote} />
						</label>
						<div class="flex gap-2">
							<button
								type="submit"
								class="btn preset-filled-primary-500 btn-sm"
								disabled={creatingPatient}
							>
								{creatingPatient ? 'Creating…' : 'Create patient'}
							</button>
							<button
								type="button"
								class="btn preset-outlined-surface-500 btn-sm"
								onclick={() => (mode = 'search')}
							>
								Back
							</button>
						</div>
					</form>
				{:else if mode === 'details' && selectedPatient}
					<div class="space-y-3">
						<div
							class="flex items-center justify-between gap-2 rounded-base bg-surface-100 px-2 py-1.5 text-sm"
						>
							<span class="min-w-0 truncate">
								{selectedPatient.last_name}, {selectedPatient.first_name}
								{#if selectedPatient.date_of_birth}
									<span class="text-surface-500">
										({formatDate(selectedPatient.date_of_birth)})
									</span>
								{/if}
							</span>
							<button
								type="button"
								class="shrink-0 text-xs text-primary-600 hover:underline"
								onclick={changePatient}
							>
								Change
							</button>
						</div>

						<div class="space-y-1.5">
							<div class="flex items-center justify-between gap-2">
								<h3 class="text-xs font-semibold text-surface-600">Existing denials</h3>
								<a
									href={resolve(`/record/${selectedPatient.id}`)}
									class="text-xs text-primary-600 hover:underline"
								>
									View patient
								</a>
							</div>
							{#if loadingDenials}
								<div
									class="rounded-base border border-surface-200 px-2 py-3 text-center text-xs text-surface-500"
								>
									Loading denials…
								</div>
							{:else if denialsError}
								<div
									class="flex items-center justify-between gap-2 rounded-base border border-error-200 bg-error-50 px-2 py-2"
								>
									<p class="text-xs text-error-700">{denialsError}</p>
									<button
										type="button"
										class="shrink-0 text-xs text-primary-600 hover:underline"
										onclick={retryPatientDenials}
									>
										Retry
									</button>
								</div>
							{:else if patientDenials.length > 0}
								<ul
									class="max-h-40 divide-y divide-surface-200 overflow-y-auto rounded-base border border-surface-200"
								>
									{#each patientDenials as denial, index (`${denial.service_start_date}-${denial.service_end_date ?? ''}-${index}`)}
										<li class="flex items-center gap-2 px-2 py-1.5 text-xs">
											<span class="min-w-0 text-surface-700">
												{formatDate(denial.service_start_date)}
												{#if denial.service_end_date}
													– {formatDate(denial.service_end_date)}
												{/if}
											</span>
											<span
												class={[
													'shrink-0 rounded-full px-1.5 py-0.5 font-medium',
													denial.is_closed
														? 'bg-surface-200 text-surface-700'
														: 'bg-success-100 text-success-700'
												]}
											>
												{denial.is_closed ? 'Closed' : 'Open'}
											</span>
											{#if canCreateNote}
												<button
													type="button"
													class="ml-auto shrink-0 text-xs font-medium text-primary-600 hover:underline"
													onclick={() => selectDenialForNote(denial)}
												>
													Add note
												</button>
											{/if}
										</li>
									{/each}
								</ul>
							{:else}
								<div
									class="rounded-base border border-surface-200 px-2 py-3 text-center text-xs text-surface-500"
								>
									No existing denials.
								</div>
							{/if}
						</div>

						{#if selectedDenial}
							<form
								method="POST"
								action="/record/{selectedPatient.id}?/createNote"
								enctype="multipart/form-data"
								use:enhance={() => {
									submittingNote = true;
									return async ({ result }) => {
										submittingNote = false;
										if (result.type === 'success') {
											toastSuccess('Note added');
											resetAll();
											await invalidateAll();
										} else if (result.type === 'failure') {
											toastError(
												(result.data as Record<string, string>)?.error || 'Failed to add note'
											);
										} else if (result.type === 'error') {
											toastError('Something went wrong');
										}
									};
								}}
								class="space-y-2"
							>
								<div
									class="flex items-center justify-between gap-2 rounded-base bg-primary-50 px-2 py-1.5 text-xs"
								>
									<span class="min-w-0 text-surface-700">
										Adding note to {formatDate(selectedDenial.service_start_date)}
										{#if selectedDenial.service_end_date}
											– {formatDate(selectedDenial.service_end_date)}
										{/if}
									</span>
									<span
										class={[
											'shrink-0 rounded-full px-1.5 py-0.5 font-medium',
											selectedDenial.is_closed
												? 'bg-surface-200 text-surface-700'
												: 'bg-success-100 text-success-700'
										]}
									>
										{selectedDenial.is_closed ? 'Closed' : 'Open'}
									</span>
								</div>
								<input type="hidden" name="denial_id" value={selectedDenial.id} />
								<input type="hidden" name="existing_files" value={fileName} />
								<label class="label">
									<span class="label-text text-xs">Note *</span>
									<textarea name="note" rows="3" required class="textarea" bind:value={existingNote}
									></textarea>
								</label>
								<div class="flex gap-2">
									<button
										type="submit"
										class="btn preset-filled-primary-500 btn-sm"
										disabled={submittingNote}
									>
										{submittingNote ? 'Adding…' : 'Add note'}
									</button>
									<button
										type="button"
										class="btn preset-outlined-surface-500 btn-sm"
										onclick={cancelExistingNote}
									>
										Back
									</button>
								</div>
							</form>
						{:else if canCreateDenial}
							<form
								method="POST"
								action="/record/{selectedPatient.id}?/createDenial"
								enctype="multipart/form-data"
								use:enhance={() => {
									submitting = true;
									return async ({ result }) => {
										submitting = false;
										if (result.type === 'success') {
											toastSuccess('Denial created');
											resetAll();
											await invalidateAll();
										} else if (result.type === 'failure') {
											toastError(
												(result.data as Record<string, string>)?.error || 'Failed to create denial'
											);
										} else if (result.type === 'error') {
											toastError('Something went wrong');
										}
									};
								}}
								class="space-y-2"
							>
								<input type="hidden" name="existing_files" value={fileName} />
								<div class="grid grid-cols-1 gap-2 @sm:grid-cols-2">
									<label class="label">
										<span class="label-text text-xs">Service start date *</span>
										<input
											type="date"
											name="service_start_date"
											required
											class="input"
											bind:value={serviceStartDate}
										/>
									</label>
									<label class="label">
										<span class="label-text text-xs">Service end date</span>
										<input
											type="date"
											name="service_end_date"
											class="input"
											bind:value={serviceEndDate}
										/>
									</label>
								</div>
								<label class="label">
									<span class="label-text text-xs">Note *</span>
									<textarea name="initial_note" rows="2" required class="textarea" bind:value={note}
									></textarea>
								</label>
								{#if exactDuplicate}
									<p
										class="rounded-base border border-error-200 bg-error-50 px-2 py-2 text-xs text-error-700"
									>
										A denial with these service dates already exists. Change the dates or review the
										patient record.
									</p>
								{/if}
								<div class="flex gap-2">
									<button
										type="submit"
										class="btn preset-filled-primary-500 btn-sm"
										disabled={submitting || loadingDenials || exactDuplicate !== null}
									>
										{submitting ? 'Creating…' : 'Create denial'}
									</button>
									<button
										type="button"
										class="btn preset-outlined-surface-500 btn-sm"
										onclick={resetAll}
									>
										Cancel
									</button>
								</div>
							</form>
						{:else}
							<p class="text-xs text-surface-500">Select “Add note” on an existing denial.</p>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
