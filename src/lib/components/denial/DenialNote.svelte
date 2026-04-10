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

	let menuOpen = $state(false);
	let editing = $state(false);
	let editText = $state('');

	function toggleMenu() {
		menuOpen = !menuOpen;
	}

	function startEdit() {
		editText = note.note;
		editing = true;
		menuOpen = false;
	}

	function cancelEdit() {
		editing = false;
		editText = note.note;
	}
</script>

<div class="rounded border border-surface-200 bg-white p-3">
	{#if editing}
		<form
			method="POST"
			action="?/updateNote"
			class="space-y-2"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						toastSuccess('Note updated');
						editing = false;
						await invalidateAll();
					} else if (result.type === 'failure') {
						toastError('Error', (result.data as Record<string, string>)?.error || 'Update failed');
						await update({ reset: false });
					} else if (result.type === 'error') {
						toastError('Something went wrong');
					}
				};
			}}
		>
			<input type="hidden" name="id" value={note.id} />
			<textarea name="note" class="textarea w-full" rows="3" required bind:value={editText}
			></textarea>
			<div class="flex gap-2">
				<button type="submit" class="btn preset-filled-primary-500 btn-sm">Save</button>
				<button type="button" class="btn preset-outlined-surface-500 btn-sm" onclick={cancelEdit}>
					Cancel
				</button>
			</div>
		</form>
	{:else}
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

			{#if permissions['update_denial'] || permissions['delete_denial']}
				<div class="relative">
					<button
						type="button"
						class="btn preset-outlined-surface-500 btn-sm px-1.5"
						title="Note actions"
						onclick={toggleMenu}
					>
						⋮
					</button>

					{#if menuOpen}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="absolute right-0 z-10 mt-1 min-w-32 rounded-lg border border-surface-200 bg-white py-1 shadow-lg"
							onmouseleave={() => (menuOpen = false)}
						>
							{#if permissions['update_denial']}
								<button
									type="button"
									class="w-full px-4 py-2 text-left text-sm hover:bg-surface-100"
									onclick={startEdit}
								>
									Edit
								</button>
							{/if}
							{#if permissions['delete_denial']}
								<form
									method="POST"
									action="?/deleteNote"
									use:enhance={() => {
										menuOpen = false;
										return async ({ result }) => {
											if (result.type === 'success') {
												toastSuccess('Note deleted');
												await invalidateAll();
											} else if (result.type === 'failure') {
												toastError(
													'Error',
													(result.data as Record<string, string>)?.error || 'Delete failed'
												);
											} else if (result.type === 'error') {
												toastError('Something went wrong');
											}
										};
									}}
								>
									<input type="hidden" name="id" value={note.id} />
									<button
										type="submit"
										class="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-surface-100"
									>
										Delete
									</button>
								</form>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
