import { createToaster } from '@skeletonlabs/skeleton-svelte';

export const toaster = createToaster({
	overlap: true,
	gap: 8,
	removeDelay: 300,
	placement: 'bottom'
});

export function toastSuccess(title: string, description?: string): void {
	toaster.success({ title, description, duration: 4000 });
}

export function toastError(title: string, description?: string): void {
	toaster.error({ title, description, duration: 6000 });
}

export function toastWarning(title: string, description?: string): void {
	toaster.warning({ title, description, duration: 5000 });
}

export function toastInfo(title: string, description?: string): void {
	toaster.create({ type: 'info', title, description, duration: 4000 });
}
