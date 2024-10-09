<script lang="ts">
	import { page } from '$app/stores';
	import { TabGroup, TabAnchor, storePopup } from '@skeletonlabs/skeleton';
	import { computePosition, autoUpdate, offset, shift, flip, arrow } from '@floating-ui/dom';

	export let data;

	storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });
</script>

<!-- Header Bar -->
<div class="flex items-center justify-between bg-slate-200 px-24 py-3 drop-shadow-md">
	<h3 class="h3 font-bold text-tertiary-500">Denials Tracker</h3>
	{#if !data.user?.username}
		<div class="flex flex-row space-x-4">
			<a href="/signin" class="variant-filled-primary btn">Sign in</a>
		</div>
	{:else}
		<div class="flex flex-row items-center space-x-4">
			<p>{data.user.username}</p>
			<form method="POST" action="/signin?/signout">
				<button type="submit" class="variant-filled-primary btn">Sign out</button>
			</form>
		</div>
	{/if}
</div>

<div class="flex flex-col items-center">
	<div class="w-full max-w-7xl">
		<!-- Navigation Bar -->
		<div class="flex flex-col items-center px-4 py-16">
			<div class="w-fit">
				<TabGroup
					justify="justify-center space-x-16"
					active="border-b-2 border-tertiary-500 text-tertiary-500"
					hover="hover:variant-soft-primary"
				>
					<TabAnchor href="/record" selected={$page.url.pathname.startsWith('/record')}
						>Record</TabAnchor
					>
					<TabAnchor href="/report" selected={$page.url.pathname.startsWith('/report')}
						>Report</TabAnchor
					>
					<TabAnchor href="/file" selected={$page.url.pathname.startsWith('/file')}>File</TabAnchor>
					<TabAnchor href="/setting" selected={$page.url.pathname.startsWith('/setting')}
						>Setting</TabAnchor
					>
				</TabGroup>
			</div>
		</div>

		<slot></slot>
	</div>
</div>
