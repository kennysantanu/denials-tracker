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
	let additionalInfo: string = '';
	let promptTextArea: string = '';
	let showPrompt: boolean = false;

	const getDenialData = async (id: string) => {
		const { data, error } = await supabase
			.from('denials')
			.select('*, notes(*)')
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
You are an expert in summarizing. Your task is to summarize the denials events.

### Detailed Instructions:
1. Summarize in one paragraph only.
2. Avoid bullet points.
3. Write the summary as the provider (we).

### Additional Information:
${additionalInfo}

### Denials Events:
`;
		for (const note of denialData.notes) {
			prompt += `(${formatDate(note.created_at)}): ${note.note}\n`;
		}
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
			<h1 class="text-lg font-bold text-tertiary-500">AI Summary</h1>
			<button on:click={parent.onClose} aria-label="Close modal">
				<XIcon />
			</button>
		</header>
		<hr />
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
