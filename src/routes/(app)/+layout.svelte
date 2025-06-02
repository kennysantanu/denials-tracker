<script lang="ts">
	import { page } from '$app/stores';
	import { AppBar, TabGroup, TabAnchor, storePopup, getDrawerStore } from '@skeletonlabs/skeleton';
	import { computePosition, autoUpdate, offset, shift, flip, arrow } from '@floating-ui/dom';
	import MenuIcon from '$lib/icons/Menu-icon.svelte';

	export let data;
	const drawerStore = getDrawerStore();

	storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });
</script>

<AppBar gridColumns="grid-cols-3" slotDefault="place-self-center" slotTrail="place-content-end">
	<svelte:fragment slot="lead">
		<button
			class="btn lg:hidden"
			on:click={() => drawerStore.open()}
			aria-label="Open navigation menu"
		>
			<MenuIcon />
		</button>
		<h3 class="h3 hidden font-bold text-tertiary-500 lg:inline">Denials Tracker</h3>
	</svelte:fragment>
	<h3 class="h3 text-center font-bold text-tertiary-500 lg:hidden">Denials Tracker</h3>
	<div class="hidden flex-col items-center px-4 lg:flex">
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
	<svelte:fragment slot="trail">
		{#if !data.user?.username}
			<div class="flex flex-row space-x-4">
				<a href="/signin" class="variant-filled-primary btn">Sign in</a>
			</div>
		{:else}
			<div class="hidden flex-row items-center space-x-4 lg:flex">
				<p>{data.user.username}</p>
			</div>
			<form method="POST" action="/signin?/signout">
				<button type="submit" class="variant-filled-primary btn">Sign out</button>
			</form>
		{/if}
	</svelte:fragment>
</AppBar>

<div class="flex flex-col items-center">
	<div class="w-full max-w-7xl">
		<div class="m-2 space-y-8">
			<slot></slot>
		</div>
	</div>
</div>
