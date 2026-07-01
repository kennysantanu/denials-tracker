<script lang="ts">
	import type { Database } from '$lib/supabase';
	import DenialNote from './DenialNote.svelte';
	import NoteForm from './NoteForm.svelte';

	type FileRow = Database['public']['Tables']['files']['Row'];

	type NoteRow = Database['public']['Tables']['notes']['Row'] & {
		created_by_user?: { username: string | null } | null;
		notes_files?: { file_name: string; files: FileRow | null }[];
	};

	interface Props {
		notes: NoteRow[];
		denialId: number;
		effectivePermissions: Record<string, boolean>;
		patientId: number;
		searchQuery?: string;
	}

	let { notes, denialId, effectivePermissions, patientId, searchQuery = '' }: Props = $props();

	let showForm = $state(false);
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between">
		<h4 class="text-sm font-semibold text-surface-700">Notes ({notes.length})</h4>
		{#if effectivePermissions['note.create'] && !showForm}
			<button
				type="button"
				class="btn preset-outlined-surface-200-800 btn-sm hover:preset-outlined-surface-500"
				onclick={() => (showForm = true)}
			>
				+ Add Note
			</button>
		{/if}
	</div>

	{#if showForm}
		<NoteForm {denialId} {patientId} oncancel={() => (showForm = false)} />
	{/if}

	{#if notes.length}
		<div class="space-y-2">
			{#each notes as note (note.id)}
				<DenialNote {note} {effectivePermissions} {patientId} {searchQuery} />
			{/each}
		</div>
	{:else}
		<p class="text-sm text-surface-500">No notes yet.</p>
	{/if}
</div>
