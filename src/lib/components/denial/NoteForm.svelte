<script lang="ts">
	import { enhance } from '$app/forms';
	import { toastSuccess, toastError } from '$lib/toast';
	import { goto, invalidateAll } from '$app/navigation';
	import { NoteEditor } from '$lib/components/ui';

	interface Props {
		denialId: number;
		patientId: number;
		oncancel: () => void;
	}

	let { denialId, patientId, oncancel }: Props = $props();

	let noteEditor = $state<ReturnType<typeof NoteEditor>>();
</script>

<form
	method="POST"
	action="?/createNote"
	enctype="multipart/form-data"
	class="space-y-3 rounded border border-surface-200 bg-white p-3"
	use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				toastSuccess('Note added');
				noteEditor?.reset();
				await invalidateAll();
				oncancel();
			} else if (result.type === 'failure') {
				toastError('Error', (result.data as Record<string, string>)?.error || 'Failed to add note');
				await update({ reset: false });
			} else if (result.type === 'redirect') {
				goto(result.location);
			} else if (result.type === 'error') {
				toastError('Something went wrong');
			}
		};
	}}
>
	<input type="hidden" name="denial_id" value={denialId} />

	<NoteEditor bind:this={noteEditor} required placeholder="Enter note..." />

	<div class="flex gap-2">
		<button type="submit" class="btn preset-filled-primary-500">Submit</button>
		<button type="button" class="btn preset-outlined-surface-500" onclick={oncancel}>
			Cancel
		</button>
	</div>
</form>
