<script lang="ts">
	export let data;
</script>

<h2 class="h2 text-tertiary-500">User List</h2>

{#if data.users}
	<ul class="list-disc">
		{#each data.users as user}
			<li>{user.username}</li>
		{/each}
	</ul>
{/if}
