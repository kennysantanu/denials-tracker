<script lang="ts">
	import XIcon from '$lib/icons/X-icon.svelte';
	import { formatDate } from '$lib/utils';
	import { onMount, type SvelteComponent } from 'svelte';
	import { getModalStore, SlideToggle, clipboard } from '@skeletonlabs/skeleton';

	export let parent: SvelteComponent;

	const modalStore = getModalStore();
	let denialId = $modalStore[0].meta.denialId;
	let supabase = $modalStore[0].meta.supabase;
	let denialData: any = null;
	let attachments: string = '';
	let additionalInfo: string = '';
	let promptTextArea: string = '';
	let showPrompt: boolean = false;

	const getDenialData = async (id: string) => {
		const { data, error } = await supabase
			.from('denials')
			.select(
				`
				id, patient_id, service_start_date, service_end_date, billed_amount, paid_amount, is_closed,
				patients (id, last_name, first_name, date_of_birth, note),
				notes (id, created_at, note)
			`
			)
			.eq('id', id)
			.single();

		if (error) {
			console.error('Error fetching denial data:', error);
			return null;
		}

		return data;
	};

	const createPrompt = (denialData: any) => {
		if (!denialData) return '';
		let prompt = `
You are an expert in revenue cycle management. Your task is to write a formal appeal from the following information:

### Patient Information:
Last Name: ${denialData.patients.last_name || 'N/A'}
First Name: ${denialData.patients.first_name || 'N/A'}
DOB: ${denialData.patients.date_of_birth ? formatDate(denialData.patients.date_of_birth) : 'N/A'}
Insurance Name: ${denialData.insurance_name || 'N/A'}
Subscriber ID: ${denialData.subscriber_id || 'N/A'}
Additional patient information:
${denialData.patients.note || 'N/A'}

### Claim Information:
Date of Service: ${denialData.service_start_date ? formatDate(denialData.service_start_date) : 'N/A'}${denialData.service_end_date ? ` - ${formatDate(denialData.service_end_date)}` : ''}
Billed Amount: ${denialData.billed_amount ? denialData.billed_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : 'N/A'}
Claim Number: ${denialData.claim_number || 'N/A'}

### Claim History:
${denialData.notes.length > 0 ? denialData.notes.map((note: { created_at: string; note: any }) => `(${formatDate(note.created_at)}): ${note.note}`).join('\n') : 'No claim history available.'}

### Attachments:
${attachments}

### Additional Information:
${additionalInfo}

### Detailed Instructions:
1. Write in paragraphs.
2. Avoid bullet points.
3. Use MM/DD/YYYY format
4. Write the body of the appeal only.
5. Does not need to mention patient and claim information as it will be included in the header of the appeal.
6. Must include expected outcome.
7. Must provide details that supports expected outcome.
8. Must mentioned all attachments.
9. Write concise and convincing appeal up to 200 words.
`;
		return prompt.trim();
	};

	onMount(() => {
		if (denialId) {
			getDenialData(denialId).then((data) => {
				denialData = data;
				promptTextArea = createPrompt(denialData);
			});
		}
	});
</script>

{#if $modalStore[0]}
	<div class="modal-example-form card w-modal space-y-4 p-4 shadow-xl">
		<header class="modal-header flex items-center justify-between {parent.regionHeader}">
			<h1 class="text-lg font-bold text-tertiary-500">AI Appeal</h1>
			<button on:click={parent.onClose} aria-label="Close modal">
				<XIcon />
			</button>
		</header>
		<hr />
		<div class="flex items-center justify-between space-x-2">
			<label class="label">
				<span class="text-tertiary-500">Insurance Name</span>
				<input
					class="input"
					type="text"
					name="insurance_name"
					id="insurance_name"
					value={denialData?.insurance_name || 'N/A'}
					on:input={(e) => {
						if (denialData) {
							denialData.insurance_name = e.target.value;
						}
					}}
				/>
			</label>
			<label class="label">
				<span class="text-tertiary-500">Subscriber ID</span>
				<input
					class="input"
					type="text"
					name="subscriber_id"
					id="subscriber_id"
					value={denialData?.subscriber_id || 'N/A'}
					on:input={(e) => {
						if (denialData) {
							denialData.subscriber_id = e.target.value;
						}
					}}
				/>
			</label>
		</div>
		<label class="label">
			<span class="text-tertiary-500">Claim Number</span>
			<input
				class="input"
				type="text"
				name="claim_number"
				id="claim_number"
				value={denialData?.claim_number || 'N/A'}
				on:input={(e) => {
					if (denialData) {
						denialData.claim_number = e.target.value;
					}
				}}
			/>
		</label>
		<label class="label">
			<span class="text-tertiary-500">Attachments</span>
			<input
				class="input"
				type="text"
				name="attachments"
				id="attachments"
				bind:value={attachments}
				placeholder="Enter attachments here..."
			/>
		</label>
		<label class="label">
			<span class="text-tertiary-500">Additional Information / Instructions</span>
			<input
				class="input"
				type="text"
				name="additional_info"
				id="additional_info"
				bind:value={additionalInfo}
				placeholder="Enter additional information here..."
			/>
		</label>
		<div>
			<SlideToggle name="showPrompt" size="sm" bind:checked={showPrompt}>Show Prompt</SlideToggle>
		</div>
		<label class="label" hidden={!showPrompt}>
			<span class="text-tertiary-500">Prompt</span>
			<textarea
				name="prompt"
				id="prompt"
				bind:value={promptTextArea}
				class="textarea-bordered textarea h-48 w-full"
				placeholder="Enter prompt here..."
				data-clipboard="prompt"
			></textarea>
		</label>
		<div class="space-x-2">
			<button
				class="variant-filled btn"
				on:click={() => {
					if (promptTextArea) {
						promptTextArea = createPrompt(denialData);
					}
				}}>Update Prompt</button
			>
			<button class="variant-filled-primary btn mt-4" use:clipboard={{ input: 'prompt' }}
				>Copy Prompt</button
			>
		</div>
	</div>
{/if}
