<script lang="ts">
	import { TabGroup, TabAnchor } from '@skeletonlabs/skeleton';
</script>

<!-- Navigation Bar -->
<div class="flex flex-col items-center px-4 py-16">
	<div class="w-fit">
		<TabGroup justify="justify-center space-x-16">
			<TabAnchor href="/record">Record</TabAnchor>
			<TabAnchor href="/report">Report</TabAnchor>
			<TabAnchor href="/setting" selected={true}>Setting</TabAnchor>
		</TabGroup>
	</div>
</div>

<!-- Setting Card -->
<div class="card w-full space-y-12 px-8 py-8">
	<div class="flex flex-row space-x-16">
		<!-- Setting Sidebar Card -->
		<div class="card w-96 basis-1/4 space-y-8 px-4 py-4">
			<div class="space-y-4">
				<div class="h3 text-tertiary-500">Admin</div>
				<ul class="space-y-4">
					<li><a href="/setting/admin/users">- Users</a></li>
					<li><a href="/setting/admin/roles">- Roles</a></li>
					<li><a href="/setting/admin/labels">- Labels</a></li>
				</ul>
				<div class="h3 text-tertiary-500">Manage</div>
				<ul class="space-y-4">
					<li><a href="/setting/manage/patients">- Patients</a></li>
				</ul>
			</div>
		</div>

		<!-- Setting Contents -->
		<div class="flex-col space-y-8">
			<slot></slot>
		</div>
	</div>
</div>
