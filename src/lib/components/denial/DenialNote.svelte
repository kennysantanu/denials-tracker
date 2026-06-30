<script lang="ts">
	import type { Database } from '$lib/supabase';
	import { enhance } from '$app/forms';
	import { toastSuccess, toastError } from '$lib/toast';
	import { invalidateAll } from '$app/navigation';
	import { formatDate } from '$lib/utils';
	import { marked } from 'marked';
	import { NoteEditor } from '$lib/components/ui';

	type FileRow = Database['public']['Tables']['files']['Row'];

	type NoteRow = Database['public']['Tables']['notes']['Row'] & {
		created_by_user?: { username: string | null } | null;
		notes_files?: { file_name: string; files: FileRow | null }[];
	};

	interface Props {
		note: NoteRow;
		effectivePermissions: Record<string, boolean>;
		patientId: number;
		searchQuery?: string;
	}

	let { note, effectivePermissions, patientId, searchQuery = '' }: Props = $props();

	function escapeHtml(str: string): string {
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function renderNote(text: string, query: string, prefix: string): string {
		const raw = marked.parse(text);
		if (typeof raw !== 'string') return '';
		// Sanitize dangerous URL schemes (SSR-safe XSS prevention)
		let html = raw.replace(/(href|src)="(javascript:|data:)[^"]*"/gi, '$1="#"');
		// Apply search highlight, tag-aware to avoid matching inside HTML attributes
		if (query.trim()) {
			const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			html = html.replace(
				new RegExp(`(?![^<]*>)(${escaped})`, 'gi'),
				'<mark class="bg-yellow-200 rounded-sm not-italic">$1</mark>'
			);
		}
		// Inject prefix inside the first <p> so date/user and note text are truly inline
		if (prefix) {
			html = html.replace(/^<p>/, `<p>${prefix}`);
		}
		return html;
	}

	let notePrefix = $derived(
		formatDate(note.created_at) +
			(note.created_by_user?.username
				? ` <span class="font-bold">(${escapeHtml(note.created_by_user.username)}): </span>`
				: note.created_by
					? ` <span class="font-bold">(${escapeHtml(note.created_by)}): </span>`
					: ' ')
	);

	let renderedNote = $derived(renderNote(note.note, searchQuery, notePrefix));

	let menuOpen = $state(false);
	let editing = $state(false);
	let editText = $state('');

	let attachedFiles = $derived(
		(note.notes_files ?? []).filter((nf) => nf.files).map((nf) => nf.files!)
	);

	let noteEditor = $state<ReturnType<typeof NoteEditor>>();

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

	function displayFileName(name: string): string {
		const parts = name.split('/');
		const last = parts[parts.length - 1];
		const match = last.match(/^\d+_(.+)$/);
		return match ? match[1] : last;
	}
</script>

<div class="rounded border border-surface-200 bg-white p-3">
	{#if editing}
		<form
			method="POST"
			action="?/updateNote"
			enctype="multipart/form-data"
			class="space-y-3"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						toastSuccess('Note updated');
						editing = false;
						noteEditor?.reset();
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
			<input type="hidden" name="patient_id" value={patientId} />
			<NoteEditor bind:this={noteEditor} bind:value={editText} required {attachedFiles} />
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
				<div class="prose prose-sm max-w-none text-surface-800">
					{@html renderedNote}
				</div>
				{#if attachedFiles.length > 0}
					<div class="mt-2 flex flex-wrap gap-2">
						{#each attachedFiles as file (file.name)}
							<a
								href="/file/view?name={encodeURIComponent(file.name)}"
								class="inline-flex items-center gap-1.5 rounded-base border border-surface-200 bg-surface-50 px-2.5 py-1 text-xs text-primary-600 transition-colors hover:bg-surface-100 hover:text-primary-800"
								title={file.name}
							>
								<span class="max-w-37.5 truncate">{displayFileName(file.name)}</span>
							</a>
						{/each}
					</div>
				{/if}
			</div>

			{#if effectivePermissions['note.update'] || effectivePermissions['note.delete']}
				<div class="relative">
					<button
						type="button"
						class="btn hover:bg-surface-200-800"
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
							{#if effectivePermissions['note.update']}
								<button
									type="button"
									class="w-full px-4 py-2 text-left text-sm hover:bg-surface-100"
									onclick={startEdit}
								>
									Edit
								</button>
							{/if}
							{#if effectivePermissions['note.delete']}
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
