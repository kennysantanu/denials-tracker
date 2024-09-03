<script lang="ts">
	import { TabGroup, TabAnchor } from '@skeletonlabs/skeleton';
</script>

<!-- Navigation Bar -->
<div class="flex flex-col items-center px-4 py-16">
	<div class="w-fit">
		<TabGroup justify="justify-center space-x-16">
			<TabAnchor href="/record" selected={true}>Record</TabAnchor>
			<TabAnchor href="/report">Report</TabAnchor>
			<TabAnchor href="/file">File</TabAnchor>
			<TabAnchor href="/setting">Setting</TabAnchor>
		</TabGroup>
	</div>
</div>

<div class="space-y-16">
	<slot></slot>
</div>
