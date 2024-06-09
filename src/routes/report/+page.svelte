<script lang="ts">
	import Header from '$lib/Header.svelte';
	import { page } from '$app/stores';
	import { TabGroup, Tab, TabAnchor } from '@skeletonlabs/skeleton';
</script>

<div class="flex flex-col items-center">
	<!-- Page Content -->
	<div class="flex w-full max-w-7xl flex-col items-center space-y-16 px-4">
		<!-- Filter Card -->
		<div class="card w-full space-y-12 px-8 py-8">
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
					<button type="button" class="variant-filled-primary btn">Create Report</button>
				</div>
			</div>
		</div>

		<!-- Table -->
		<div class="card h-screen w-full content-center">
			<h1 class="h1 text-center">AG GRID</h1>
		</div>
	</div>
</div>
