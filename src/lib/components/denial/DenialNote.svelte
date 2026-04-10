<script lang="ts">
	import type { Database } from '$lib/supabase';
	import { enhance } from '$app/forms';
	import { toastSuccess, toastError } from '$lib/toast';
	import { invalidateAll } from '$app/navigation';
	import { formatDate } from '$lib/utils';

	type NoteRow = Database['public']['Tables']['notes']['Row'] & {
		created_by_user?: { username: string | null } | null;
	};

	interface Props {
		note: NoteRow;
		permissions: Record<string, boolean>;
		patientId: number;
	}

	let { note, permissions, patientId }: Props = $props();
</script>

<div class="rounded border border-surface-200 bg-white p-3">
	<div class="flex items-start justify-between gap-2">
		<div class="flex-1">
			<p class="text-sm whitespace-pre-wrap text-surface-800">{note.note}</p>
			<p class="mt-1 text-xs text-surface-500">
				{formatDate(note.created_at)}
				{#if note.created_by_user?.username}
					<span>by {note.created_by_user.username}</span>
				{:else if note.created_by}
					<span>by {note.created_by}</span>
				{/if}
			</p>
		</div>

		{#if permissions['delete_denial']}
			<form
				method="POST"
				action="?/deleteNote"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success') {
							toastSuccess('Note deleted');
							await invalidateAll();
						} else if (result.type === 'failure') {
							toastError((result.data as Record<string, string>)?.error || 'Delete failed');
						} else if (result.type === 'error') {
							toastError('Something went wrong');
						}
					};
				}}
			>
				<input type="hidden" name="id" value={note.id} />
				<input type="hidden" name="patientId" value={patientId} />
				<button type="submit" class="btn preset-outlined-error-500 btn-sm" title="Delete note">
					Delete
				</button>
			</form>
		{/if}
	</div>
</div>
