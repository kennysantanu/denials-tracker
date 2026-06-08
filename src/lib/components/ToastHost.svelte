<script lang="ts">
	import { Toast } from '@skeletonlabs/skeleton-svelte';
	import { toaster } from '$lib/toast';

	const toastTypeIcons: Record<string, string> = {
		success: '✔',
		error: '✖',
		warning: '⚠',
		info: 'ℹ'
	};
	const toastTypeIconColors: Record<string, string> = {
		success: 'text-success-600',
		error: 'text-error-600',
		warning: 'text-warning-600',
		info: 'text-primary-600'
	};
	const toastTypeStyles: Record<string, string> = {
		success: 'border-l-4 border-l-success-500 bg-success-50',
		error: 'border-l-4 border-l-error-500 bg-error-50',
		warning: 'border-l-4 border-l-warning-500 bg-warning-50',
		info: 'border-l-4 border-l-primary-500 bg-primary-50'
	};
</script>

<Toast.Group {toaster}>
	{#snippet children(toast)}
		<Toast {toast} class={toastTypeStyles[toast.type ?? ''] ?? 'border-l-4 border-l-surface-400'}>
			<div class="flex w-full flex-col gap-1">
				<div class="flex items-center justify-between gap-2">
					<div class="flex min-w-0 items-center gap-2">
						<span
							class="shrink-0 text-sm font-bold {toastTypeIconColors[toast.type ?? ''] ??
								'text-surface-600'}">{toastTypeIcons[toast.type ?? ''] ?? '•'}</span
						>
						<Toast.Title class="text-sm font-semibold text-surface-900">{toast.title}</Toast.Title>
					</div>
					<Toast.CloseTrigger
						class="shrink-0 rounded p-1 text-surface-500 transition-colors hover:bg-black/10 hover:text-surface-900"
						aria-label="Dismiss"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="size-4"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
								clip-rule="evenodd"
							/>
						</svg>
					</Toast.CloseTrigger>
				</div>
				{#if toast.description}
					<Toast.Description class="pl-5 text-sm text-surface-700"
						>{toast.description}</Toast.Description
					>
				{/if}
			</div>
		</Toast>
	{/snippet}
</Toast.Group>
