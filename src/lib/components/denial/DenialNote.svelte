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
		permissions: Record<string, boolean>;
		patientId: number;
		searchQuery?: string;
	}

	let { note, permissions, patientId, searchQuery = '' }: Props = $props();

	function renderNote(text: string, query: string): string {
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
		return html;
	}

	let renderedNote = $derived(renderNote(note.note, searchQuery));

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

	function formatBytes(bytes: number | null): string {
		if (!bytes) return '';
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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
								class="inline-flex items-center gap-1.5 rounded-md border border-surface-200 bg-surface-50 px-2.5 py-1 text-xs text-primary-600 transition-colors hover:bg-surface-100 hover:text-primary-800"
								title={file.name}
							>
								<svg
									class="h-3.5 w-3.5 shrink-0"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
									/>
								</svg>
								<span class="max-w-37.5 truncate">{displayFileName(file.name)}</span>
								{#if file.size}
									<span class="text-surface-400">({formatBytes(file.size)})</span>
								{/if}
							</a>
						{/each}
					</div>
				{/if}
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
