<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { createGrid } from 'ag-grid-community';
	import 'ag-grid-community/styles/ag-grid.css';
	import 'ag-grid-community/styles/ag-theme-quartz.css';

	export let form;
	let agGrid;
	$: denialData = form?.denials || [];

	const gridOptions = {
		columnDefs: [
			{
				headerName: 'Patient',
				valueGetter: (params) => params.data.patients.last_name,
				valueFormatter: (params) => {
					const fDate = formatDate(params.data.patients.date_of_birth);
					return `${params.data.patients.last_name}, ${params.data.patients.first_name} (${fDate})`;
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
				headerName: 'Labels',
				cellRenderer: (denialData) => {
					const eDiv = document.createElement('div');
					eDiv.classList.add('flex');
					eDiv.classList.add('flex-wrap');
					eDiv.classList.add('space-x-2');
					for (let label of denialData.data.labels) {
						const span = document.createElement('span');
						span.innerHTML = `<span class="variant-filled chip" style="background-color: ${label.bg_color}; color: ${label.txt_color};">${label.label_name}</span>`;
						eDiv.appendChild(span);
					}
					return eDiv;
				}
			},
			{
				headerName: 'Last Note',
				valueGetter: (params) => params.data.notes[0].created_at,
				valueFormatter: (params) => {
					const fDate = formatDate(params.data.notes[0].created_at);
					return `(${fDate}) ${params.data.notes[0].note}`;
				}
			}
		]
	};

	const updateGrid = () => {
		agGrid!.setGridOption('rowData', denialData);
	};

	const formatDate = (date: String): String => {
		const dateString = date.toString();
		const formattedDate = `${dateString.substring(5, 7)}/${dateString.substring(8, 10)}/${dateString.substring(2, 4)}`;
		return formattedDate;
	};

	onMount(() => {
		const myGridElement = document.querySelector('#agGrid');
		agGrid = createGrid(myGridElement, gridOptions);
	});
</script>

<!-- Filter Card -->
<form
	action="?/getDenialReport"
	method="post"
	use:enhance={() => {
		return async ({ result, update }) => {
			updateGrid();
			update();
		};
	}}
>
	<div class="card px-8 py-8">
		<div class="flex flex-wrap items-end justify-between space-x-8">
			<label class="label">
				<span class="text-tertiary-500">Filter</span>
				<select class="select">
					<option value="1">Option 1</option>
					<option value="2">Option 2</option>
					<option value="3">Option 3</option>
				</select>
			</label>
			<label class="label">
				<span class="text-tertiary-500">Condition</span>
				<select class="select">
					<option value="1">Option 1</option>
					<option value="2">Option 2</option>
					<option value="3">Option 3</option>
				</select>
			</label>
			<label class="label">
				<span class="text-tertiary-500">Value</span>
				<select class="select">
					<option value="1">Option 1</option>
					<option value="2">Option 2</option>
					<option value="3">Option 3</option>
				</select>
			</label>
			<div>
				<button type="submit" class="variant-filled-primary btn">Create Report</button>
			</div>
		</div>
	</div>
</form>

<!-- Table -->
<div id="agGrid" class="ag-theme-quartz h-screen"></div>
