<script lang="ts">
	import type { FileViewSibling } from '$lib/server/db/files';

	interface Props {
		siblings: FileViewSibling[];
		currentFileName: string;
	}

	let { siblings, currentFileName }: Props = $props();

	function extractFileName(path: string): string {
		return path.split('/').pop() ?? path;
	}

	function viewHref(name: string): string {
		return `/file/view?name=${encodeURIComponent(name)}`;
	}

	function getStatus(metadata: FileViewSibling['metadata']): string {
		const meta =
			metadata && typeof metadata === 'object' && !Array.isArray(metadata)
				? (metadata as Record<string, unknown>)
				: {};
		return (meta.status as string) ?? 'New';
	}

	function formatTime(iso: string): string {
		return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
</script>

<nav aria-label="Files uploaded on this date">
	{#if siblings.length === 0}
		<p class="px-2 py-4 text-sm text-surface-500">No other files on this date.</p>
	{:else}
		<ul class="space-y-1">
			{#each siblings as file (file.name)}
				{@const isCurrent = file.name === currentFileName}
				{@const status = getStatus(file.metadata)}
				<li>
					<a
						href={viewHref(file.name)}
						aria-current={isCurrent ? 'page' : undefined}
						title={extractFileName(file.name)}
						class="flex flex-col gap-1 rounded-base px-2 py-2 text-sm {isCurrent
							? 'bg-primary-100 font-medium text-primary-800'
							: 'text-surface-700 hover:bg-surface-100'}"
					>
						<span class="flex items-center justify-between gap-2">
							<span class="min-w-0 flex-1 truncate">{extractFileName(file.name)}</span>
							<span class="shrink-0 text-xs text-surface-400">
								{formatTime(file.created_at)}
							</span>
						</span>
						<span
							class="badge w-fit {status === 'Completed'
								? 'preset-tonal-success'
								: status === 'In Progress'
									? 'preset-tonal-warning'
									: 'preset-tonal-surface'}"
						>
							{status}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</nav>
