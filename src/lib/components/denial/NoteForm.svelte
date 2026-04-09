<script lang="ts">
	import { enhance } from '$app/forms';
	import { toastSuccess, toastError } from '$lib/toast';
	import { goto, invalidateAll } from '$app/navigation';

	interface Props {
		denialId: number;
		patientId: number;
		oncancel: () => void;
	}

	let { denialId, patientId, oncancel }: Props = $props();
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
				await invalidateAll();
				oncancel();
			} else if (result.type === 'failure') {
				toastError((result.data as Record<string, string>)?.error || 'Failed to add note');
				await update({ reset: false });
			} else if (result.type === 'redirect') {
				goto(result.location);
			} else if (result.type === 'error') {
				toastError('Something went wrong');
			}
		};
	}}
>
	<input type="hidden" name="denialId" value={denialId} />
	<input type="hidden" name="patientId" value={patientId} />

	<label class="label">
		<span class="label-text text-sm font-medium">Note</span>
		<textarea name="note" class="textarea" rows="3" required placeholder="Enter note..."></textarea>
	</label>

	<label class="label">
		<span class="label-text text-sm font-medium">Attachments (optional)</span>
		<input type="file" name="files" multiple class="input" />
	</label>

	<div class="flex gap-2">
		<button type="submit" class="btn btn-sm preset-filled-primary-500">Submit</button>
		<button type="button" class="btn btn-sm preset-outlined-surface-500" onclick={oncancel}>
			Cancel
		</button>
	</div>
</form>
