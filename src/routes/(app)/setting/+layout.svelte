<script lang="ts">
	import { TabGroup, TabAnchor } from '@skeletonlabs/skeleton';

	export let data;
</script>

<!-- Setting Card -->
<div class="card w-full space-y-12 px-8 py-8">
	<div class="flex flex-row space-x-16">
		<!-- Setting Sidebar Card -->
		<div class="card w-96 basis-1/4 space-y-8 px-4 py-4">
			<div class="space-y-4">
				{#if data.user?.role.permissions.admin_read == true}
					<div class="h3 text-tertiary-500">Admin</div>
					<ul class="space-y-4">
						<li><a href="/setting/admin/users">- Users</a></li>
						<li><a href="/setting/admin/roles">- Roles</a></li>
						<li><a href="/setting/admin/labels">- Labels</a></li>
					</ul>
				{/if}
				<div class="h3 text-tertiary-500">Manage</div>
				<ul class="space-y-4">
					<li><a href="/setting/manage/account">- Account</a></li>
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
