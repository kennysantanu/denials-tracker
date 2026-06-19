<script lang="ts">
	let {
		open = false,
		title,
		message,
		confirmLabel = 'Delete',
		cancelLabel = 'Cancel',
		onconfirm,
		oncancel
	}: {
		open?: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		onconfirm: () => void;
		oncancel: () => void;
	} = $props();
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/40 p-4"
		role="presentation"
	>
		<div
			class="card w-full max-w-md border border-surface-200 bg-white p-6 shadow-xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="confirm-dialog-title"
		>
			<h2 id="confirm-dialog-title" class="text-lg font-semibold text-surface-900">
				{title}
			</h2>
			<p class="mt-2 text-sm text-surface-600">{message}</p>
			<div class="mt-6 flex justify-end gap-2">
				<button type="button" class="btn preset-tonal btn-sm" onclick={oncancel}>
					{cancelLabel}
				</button>
				<button type="button" class="btn preset-filled-error-500 btn-sm" onclick={onconfirm}>
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
