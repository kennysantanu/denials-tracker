<script lang="ts">
	import { computePosition, autoUpdate, offset, shift, flip, arrow } from '@floating-ui/dom';
	import { storePopup } from '@skeletonlabs/skeleton';
	
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
			<p>Welcome back, {data.user.username}</p>
			<form method="POST" action="/signin?/signout">
				<button type="submit" class="variant-filled-primary btn">Sign out</button>
			</form>
		</div>
	{/if}
</div>

<div class="flex flex-col items-center">
	<div class="w-full max-w-7xl">
		<slot></slot>
	</div>
</div>
