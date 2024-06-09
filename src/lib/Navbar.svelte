<script lang="ts">
	import { TabGroup, TabAnchor } from '@skeletonlabs/skeleton';
	import { page } from '$app/stores';
</script>

<div class="flex flex-col items-center px-4 py-16">
	<div class="w-fit">
		<TabGroup justify="justify-center space-x-16">
			<TabAnchor href="/record" selected={$page.url.pathname === '/record'}>Record</TabAnchor>
			<TabAnchor href="/report" selected={$page.url.pathname === '/report'}>Report</TabAnchor>
			<TabAnchor href="/setting" selected={$page.url.pathname === '/setting'}>Setting</TabAnchor>
		</TabGroup>
	</div>
</div>
