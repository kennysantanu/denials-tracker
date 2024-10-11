<script lang="ts">
	import { onMount } from 'svelte';
	import { createGrid } from 'ag-grid-community';
	import 'ag-grid-community/styles/ag-grid.css';
	import 'ag-grid-community/styles/ag-theme-quartz.css';
	import type { GridOptions, ICellRendererParams } from 'ag-grid-community';

	export let data;
	let agGrid;
	let denialData = data.denials;

	const gridOptions: GridOptions = {
		columnDefs: [
			{
				headerName: 'Patient',
				valueGetter: (params) => params.data.patients.last_name,
				cellRenderer: (params: ICellRendererParams) => {
					const fDate = formatDate(params.data.patients.date_of_birth);
					return `<a href="/record?patient_id=${params.data.patients.id}" target="_blank">${params.data.patients.last_name}, ${params.data.patients.first_name} (${fDate})</a>`;
				}
			},
			{
				headerName: 'Date of Service',
				valueGetter: (params) => params.data.service_start_date,
				valueFormatter: (params) => formatDate(params.value)
			},
			{
				headerName: 'Billed Amount',
				valueGetter: (params) => params.data.billed_amount,
				valueFormatter: (params) => `$${params.value}`
			},
			{
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

	const formatDate = (date: string): string => {
		const dateString = date.toString();
		const formattedDate = `${dateString.substring(5, 7)}/${dateString.substring(8, 10)}/${dateString.substring(2, 4)}`;
		return formattedDate;
	};

	onMount(() => {
		const myGridElement = document.querySelector('#agGrid');
		if (myGridElement) {
			agGrid = createGrid(myGridElement as HTMLElement, gridOptions);
			agGrid.setGridOption('rowData', denialData);
		}
	});
</script>

<!-- AG Grid Table -->
<div id="agGrid" class="ag-theme-quartz h-screen"></div>
