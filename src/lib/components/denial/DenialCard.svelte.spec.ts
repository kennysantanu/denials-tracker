import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DenialCard from './DenialCard.svelte';

// Mock SvelteKit modules
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

vi.mock('$lib/stores/chatContext.svelte', () => ({
	openChatDrawer: vi.fn(),
	updateChatContext: vi.fn()
}));

const baseDenial = {
	id: 1,
	patient_id: 10,
	service_start_date: '2024-01-15',
	service_end_date: '2024-01-20',
	billed_amount: 1500.0,
	paid_amount: 750.5,
	is_closed: false,
	follow_up_date: '2024-02-01',
	created_at: '2024-01-01T00:00:00Z',
	updated_at: '2024-01-01T00:00:00Z',
	insurances: [{ id: 1, name: 'Blue Cross', created_at: '2024-01-01' }],
	labels: [
		{
			id: 1,
			label_name: 'Urgent',
			bg_color: '#fee2e2',
			txt_color: '#991b1b',
			sort_order: 1,
			created_at: '2024-01-01'
		}
	],
	notes: [{ id: 1, note: 'Test note', created_at: '2024-01-01T00:00:00Z', created_by: 'admin' }]
};

const allInsurances = [{ id: 1, name: 'Blue Cross', created_at: '2024-01-01' }];
const allLabels = [
	{
		id: 1,
		label_name: 'Urgent',
		bg_color: '#fee2e2',
		txt_color: '#991b1b',
		sort_order: 1,
		created_at: '2024-01-01'
	}
];

describe('DenialCard.svelte', () => {
	it('renders denial amounts and dates', async () => {
		render(DenialCard, {
			denial: baseDenial as any,
			effectivePermissions: {},
			patientId: 10,
			insurances: allInsurances as any,
			labels: allLabels as any
		});

		await expect.element(page.getByText('$1500.00', { exact: false })).toBeInTheDocument();
		await expect.element(page.getByText('$750.50', { exact: false })).toBeInTheDocument();
		await expect.element(page.getByText('Open')).toBeInTheDocument();
	});

	it('shows follow_up_date when present', async () => {
		render(DenialCard, {
			denial: baseDenial as any,
			effectivePermissions: {},
			patientId: 10,
			insurances: allInsurances as any,
			labels: allLabels as any
		});

		await expect.element(page.getByText('Follow-up:', { exact: false })).toBeInTheDocument();
	});

	it('shows Edit button when denial.update permission is true', async () => {
		render(DenialCard, {
			denial: baseDenial as any,
			effectivePermissions: { 'denial.update': true },
			patientId: 10,
			insurances: allInsurances as any,
			labels: allLabels as any
		});

		await page.getByTitle('Actions').click();
		await expect.element(page.getByText('Edit')).toBeInTheDocument();
	});

	it('hides Edit button when denial.update permission is false', async () => {
		render(DenialCard, {
			denial: baseDenial as any,
			effectivePermissions: {},
			patientId: 10,
			insurances: allInsurances as any,
			labels: allLabels as any
		});

		await expect.element(page.getByText('Edit')).not.toBeInTheDocument();
	});

	it('shows Delete button when denial.delete permission is true', async () => {
		render(DenialCard, {
			denial: baseDenial as any,
			effectivePermissions: { 'denial.delete': true },
			patientId: 10,
			insurances: allInsurances as any,
			labels: allLabels as any
		});

		await page.getByTitle('Actions').click();
		await expect.element(page.getByRole('button', { name: 'Delete' }).first()).toBeInTheDocument();
	});

	it('hides Delete button when denial.delete permission is false', async () => {
		render(DenialCard, {
			denial: baseDenial as any,
			effectivePermissions: {},
			patientId: 10,
			insurances: allInsurances as any,
			labels: allLabels as any
		});

		await expect.element(page.getByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
	});

	it('shows Summary button when aiEnabled and ai.summary permission is true', async () => {
		render(DenialCard, {
			denial: baseDenial as any,
			effectivePermissions: { 'ai.summary': true },
			patientId: 10,
			insurances: allInsurances as any,
			labels: allLabels as any,
			aiEnabled: true
		});

		await page.getByTitle('Actions').click();
		await expect.element(page.getByText('Summary', { exact: false })).toBeInTheDocument();
	});

	it('hides Summarize button when aiEnabled is false', async () => {
		render(DenialCard, {
			denial: baseDenial as any,
			effectivePermissions: { 'ai.summary': true },
			patientId: 10,
			insurances: allInsurances as any,
			labels: allLabels as any,
			aiEnabled: false
		});

		await expect.element(page.getByText('Summarize', { exact: false })).not.toBeInTheDocument();
	});

	it('shows Closed badge for closed denial', async () => {
		const closedDenial = { ...baseDenial, is_closed: true };
		render(DenialCard, {
			denial: closedDenial as any,
			effectivePermissions: {},
			patientId: 10,
			insurances: allInsurances as any,
			labels: allLabels as any
		});

		await expect.element(page.getByText('Closed')).toBeInTheDocument();
	});

	it('renders label badges', async () => {
		render(DenialCard, {
			denial: baseDenial as any,
			effectivePermissions: {},
			patientId: 10,
			insurances: allInsurances as any,
			labels: allLabels as any
		});

		await expect.element(page.getByText('Urgent')).toBeInTheDocument();
	});

	it('renders insurance names', async () => {
		render(DenialCard, {
			denial: baseDenial as any,
			effectivePermissions: {},
			patientId: 10,
			insurances: allInsurances as any,
			labels: allLabels as any
		});

		await expect.element(page.getByText('Blue Cross', { exact: false })).toBeInTheDocument();
	});

	it('shows notes count', async () => {
		render(DenialCard, {
			denial: baseDenial as any,
			effectivePermissions: {},
			patientId: 10,
			insurances: allInsurances as any,
			labels: allLabels as any
		});

		await expect.element(page.getByText('Notes (1)')).toBeInTheDocument();
	});
});
