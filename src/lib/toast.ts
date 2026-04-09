import { createToaster } from '@skeletonlabs/skeleton-svelte';

export const toaster = createToaster({
	overlap: true,
	gap: 16,
	removeDelay: 200
});

export function toastSuccess(title: string, description?: string): void {
	toaster.success({ title, description, duration: 4000 });
}

export function toastError(title: string, description?: string): void {
	toaster.error({ title, description, duration: 6000 });
}
