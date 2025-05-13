<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { createGrid } from 'ag-grid-community';
	import { formatDate } from '$lib/utils';
	import 'ag-grid-community/styles/ag-grid.css';
	import 'ag-grid-community/styles/ag-theme-quartz.css';
	import type { GridApi, GridOptions, ICellRendererParams } from 'ag-grid-community';

	let reportType: string;
	let agGrid: GridApi;
	let myGridElement: Element;
	let savedFilterModel = {};
	let showAgGrid = false;

	const denialsGridOptions: GridOptions = {
		columnDefs: [
			{
				colId: 'patient',
				headerName: 'Patient',
				valueGetter: (params) => params.data.patients.last_name,
				cellRenderer: (params: ICellRendererParams) => {
					const fDate = formatDate(params.data.patients.date_of_birth);
					return `<a href="/record?patient_id=${params.data.patients.id}" target="_blank">${params.data.patients.last_name}, ${params.data.patients.first_name} (${fDate})</a>`;
				}
			},
			{
				colId: 'date_of_service',
				headerName: 'Date of Service',
				valueGetter: (params) => params.data.service_start_date,
				valueFormatter: (params) => formatDate(params.value)
			},
			{
				colId: 'billed_amount',
				headerName: 'Billed Amount',
				valueGetter: (params) => params.data.billed_amount,
				valueFormatter: (params) => `$${params.value}`
			},
			{
				colId: 'insurances',
				headerName: 'Insurances',
				valueGetter: (params) => {
					const insurances = params.data.insurances;
					const insuranceNames = insurances.map((insurance) => insurance.name);
					return insuranceNames.join(' ');
				},
				cellRenderer: (params: ICellRendererParams) => {
					const eDiv = document.createElement('div');
					eDiv.classList.add('flex');
					eDiv.classList.add('flex-wrap');
					eDiv.classList.add('space-x-2');
					for (let insurance of params.data.insurances) {
						const span = document.createElement('span');
						span.innerHTML = `<span class="variant-ringed-surface badge" >${insurance.name}</span>`;
						eDiv.appendChild(span);
					}
					return eDiv;
				},
				filter: 'agTextColumnFilter',
				filterParams: {
					buttons: ['reset'],
					filterOptions: ['contains', 'notContains', 'blank', 'notBlank']
				}
			},
			{
				colId: 'labels',
				headerName: 'Labels',
				valueGetter: (params) => {
					const labels = params.data.labels;
					const labelNames = labels.map((label) => label.label_name);
					return labelNames.join(' ');
				},
				cellRenderer: (params: ICellRendererParams) => {
					const eDiv = document.createElement('div');
					eDiv.classList.add('flex');
					eDiv.classList.add('flex-wrap');
					eDiv.classList.add('space-x-2');
					for (let label of params.data.labels) {
						const span = document.createElement('span');
						span.innerHTML = `<span class="variant-filled badge" style="background-color: ${label.bg_color}; color: ${label.txt_color};">${label.label_name}</span>`;
						eDiv.appendChild(span);
					}
					return eDiv;
				},
				filter: 'agTextColumnFilter',
				filterParams: {
					buttons: ['reset'],
					filterOptions: ['contains', 'notContains', 'blank', 'notBlank']
				}
			},
			{
				colId: 'last_note',
				headerName: 'Last Note',
				valueGetter: (params) => {
					return params.data.notes[0]?.created_at;
				},
				valueFormatter: (params) => {
					if (params.data.notes[0]) {
						const fDate = formatDate(params.data.notes[0].created_at);
						return `(${fDate}) ${params.data.notes[0].created_by.username}: ${params.data.notes[0].note}`;
					}
					return '';
				},
				flex: 1
			}
		]
	};

	const updateSearchParams = (key: string, value: string) => {
		const searchParams = $page.url.searchParams;
		searchParams.set(key, value);
		const newUrl = `${$page.url.pathname}?${searchParams.toString()}`;
		goto(newUrl);
	};

	const clearFilters = () => {
		agGrid.setFilterModel(null);
	};

	const generateReport = (reportData) => {
		agGrid = createGrid(myGridElement as HTMLElement, denialsGridOptions);
		agGrid.setGridOption('rowData', reportData);
		agGrid.addEventListener('filterChanged', () =>
			updateSearchParams('filters', encodeURIComponent(JSON.stringify(agGrid.getFilterModel())))
		);
		agGrid.setFilterModel(savedFilterModel);
		agGrid.applyColumnState({
			state: [
				{
					colId: 'last_note',
					sort: 'asc'
				}
			]
		});
		showAgGrid = true;
	};

	onMount(() => {
		// Initialize AG Grid Element
		const gridElement = document.querySelector('#agGrid');
		if (gridElement) {
			myGridElement = gridElement;
		}

		// Get the report type from the URL
		reportType = $page.url.searchParams.get('report_type') ?? '';

		if (!reportType) {
			updateSearchParams('report_type', 'denials');
			reportType = 'denials';
		}

		// Get the saved filter model from the URL
		savedFilterModel = JSON.parse(
			decodeURIComponent($page.url.searchParams.get('filters') ?? '{}')
		);

		// Check if the report type is populated and if so, generate the report
		if (reportType == 'denials') {
			const form = document.querySelector('#reportForm') as HTMLFormElement;
			(form.elements.namedItem('report_type') as HTMLInputElement).value = reportType;
			form.requestSubmit();
		}
	});
</script>

<div class="card w-full space-y-8 p-8 ring-surface-300">
	<form
		method="POST"
		action="?/getReport"
		id="reportForm"
		class="flex flex-col space-y-4"
		use:enhance={() => {
			return async ({ result, update }) => {
				generateReport(result.data.dataReport);
				update();
			};
		}}
	>
		<label class="label">
			<span class="text-tertiary-500">Report Type</span>
			<select
				name="report_type"
				class="select"
				bind:value={reportType}
				on:change={() => updateSearchParams('report_type', reportType)}
			>
				<option value="denials">Denials</option>
			</select>
		</label>
		<div>
			<button type="submit" class="variant-filled-primary btn"> Generate Report </button>
		</div>
	</form>
</div>

{#if showAgGrid}
	<div>
		<button class="variant-filled-secondary btn" on:click={clearFilters}>Clear Filters</button>
	</div>
{/if}
<!-- AG Grid Table -->
<div id="agGrid" class="ag-theme-quartz h-screen"></div>
