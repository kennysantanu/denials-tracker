import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FileViewMobileTabs from './FileViewMobileTabs.svelte';

vi.mock('$app/forms', () => ({
	enhance: () => () => {}
}));

vi.mock('$app/navigation', () => ({
	invalidateAll: vi.fn().mockResolvedValue(undefined),
	goto: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('$lib/toast', () => ({
	toastSuccess: vi.fn(),
	toastError: vi.fn()
}));

const fileRecord = {
	name: '2026-07-27/EOB_1042.pdf',
	created_at: '2026-07-27T10:00:00Z',
	size: 12345,
	mimetype: 'application/pdf',
	metadata: { status: 'New', note: '' }
};

const siblings = [
	{ name: '2026-07-27/EOB_1040.pdf', created_at: '2026-07-27T08:00:00Z', metadata: null },
	{ name: '2026-07-27/EOB_1042.pdf', created_at: '2026-07-27T10:00:00Z', metadata: null }
];

describe('FileViewMobileTabs.svelte', () => {
	it('defaults to the Document tab', async () => {
		render(FileViewMobileTabs, {
			fileName: fileRecord.name,
			signedUrl: 'https://example.com/signed',
			fileRecord: fileRecord as any,
			canEdit: true,
			canDelete: true,
			canCreateDenial: true,
			canCreatePatient: true,
			canCreateNote: true,
			siblings: siblings as any,
			relatedClaims: []
		});

		const documentTab = page.getByRole('tab', { name: 'Document' });
		await expect.element(documentTab).toHaveAttribute('aria-selected', 'true');

		const filesTab = page.getByRole('tab', { name: 'Files' });
		await expect.element(filesTab).toHaveAttribute('aria-selected', 'false');
	});

	it('switches tabs on click and keeps File Info mounted', async () => {
		render(FileViewMobileTabs, {
			fileName: fileRecord.name,
			signedUrl: 'https://example.com/signed',
			fileRecord: fileRecord as any,
			canEdit: true,
			canDelete: true,
			canCreateDenial: true,
			canCreatePatient: true,
			canCreateNote: true,
			siblings: siblings as any,
			relatedClaims: []
		});

		const infoTab = page.getByRole('tab', { name: 'File Info' });
		await infoTab.click();

		await expect.element(infoTab).toHaveAttribute('aria-selected', 'true');
		await expect.element(page.getByText(fileRecord.name)).toBeInTheDocument();
	});
});
