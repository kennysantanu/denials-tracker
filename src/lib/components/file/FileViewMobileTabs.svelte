<script lang="ts">
	import FileSiblingList from './FileSiblingList.svelte';
	import FileDocumentViewer from './FileDocumentViewer.svelte';
	import FileInfoPanel from './FileInfoPanel.svelte';
	import type { FileViewSibling } from '$lib/server/db/files';
	import type { Database } from '$lib/supabase';

	type FilesRow = Database['public']['Tables']['files']['Row'];

	interface Props {
		fileName: string;
		signedUrl: string;
		fileRecord: FilesRow | null;
		canEdit: boolean;
		canDelete: boolean;
		siblings: FileViewSibling[];
	}

	let { fileName, signedUrl, fileRecord, canEdit, canDelete, siblings }: Props = $props();

	type TabId = 'files' | 'document' | 'info';
	const tabs: { id: TabId; label: string }[] = [
		{ id: 'files', label: 'Files' },
		{ id: 'document', label: 'Document' },
		{ id: 'info', label: 'File Info' }
	];

	let activeTab = $state<TabId>('document');
	let tabButtons: Record<TabId, HTMLButtonElement | undefined> = $state({
		files: undefined,
		document: undefined,
		info: undefined
	});

	function selectTab(id: TabId) {
		activeTab = id;
	}

	function handleKeydown(event: KeyboardEvent, index: number) {
		if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
		event.preventDefault();
		const delta = event.key === 'ArrowRight' ? 1 : -1;
		const nextIndex = (index + delta + tabs.length) % tabs.length;
		const nextTab = tabs[nextIndex];
		activeTab = nextTab.id;
		tabButtons[nextTab.id]?.focus();
	}
</script>

<div class="md:hidden">
	<div
		role="tablist"
		aria-label="File view sections"
		class="grid grid-cols-3 border-b border-surface-200"
	>
		{#each tabs as tab, index (tab.id)}
			<button
				bind:this={tabButtons[tab.id]}
				type="button"
				role="tab"
				id="file-view-tab-{tab.id}"
				aria-selected={activeTab === tab.id}
				aria-controls="file-view-panel-{tab.id}"
				tabindex={activeTab === tab.id ? 0 : -1}
				class="border-b-2 px-2 py-3 text-sm font-medium {activeTab === tab.id
					? 'border-primary-500 text-primary-700'
					: 'border-transparent text-surface-500'}"
				onclick={() => selectTab(tab.id)}
				onkeydown={(event) => handleKeydown(event, index)}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	<div
		role="tabpanel"
		id="file-view-panel-files"
		aria-labelledby="file-view-tab-files"
		hidden={activeTab !== 'files'}
		class="py-4"
	>
		<FileSiblingList {siblings} currentFileName={fileName} />
	</div>

	<div
		role="tabpanel"
		id="file-view-panel-document"
		aria-labelledby="file-view-tab-document"
		hidden={activeTab !== 'document'}
		class="py-4"
	>
		<FileDocumentViewer {fileName} {signedUrl} />
	</div>

	<div
		role="tabpanel"
		id="file-view-panel-info"
		aria-labelledby="file-view-tab-info"
		hidden={activeTab !== 'info'}
		class="py-4"
	>
		{#if fileRecord}
			<FileInfoPanel {fileName} {fileRecord} {canEdit} {canDelete} />
		{/if}
	</div>
</div>
