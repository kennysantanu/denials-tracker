<script lang="ts">
	export let data;
</script>

<!-- Header Bar -->
<div class="flex items-center justify-between bg-slate-200 px-24 py-3 drop-shadow-md">
	<h3 class="h3 font-bold text-tertiary-500">Denials Tracker</h3>
	{#if !data.session?.user.user_metadata.username}
		<div class="flex flex-row space-x-4">
			<a href="/signin" class="variant-filled-primary btn">Sign in</a>
		</div>
	{:else}
		<div class="flex flex-row items-center space-x-4">
			<p>Welcome back, {data.session?.user.user_metadata.username}</p>
			<form method="POST" action="/signin?/signout">
				<button type="submit" class="variant-filled-primary btn">Sign out</button>
			</form>
		</div>
	{/if}
</div>

<div class="flex flex-col items-center">
	<div class="max-w-7xl w-full">
		<slot></slot>
	</div>
</div>
