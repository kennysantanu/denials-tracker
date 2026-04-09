<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Error — Denials Tracker</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-surface-50 px-4">
	<div class="text-center">
		<h1 class="text-6xl font-bold text-surface-300">{page.status}</h1>
		<p class="mt-4 text-lg text-surface-600">
			{#if page.status === 404}
				Page not found.
			{:else}
				Something went wrong.
			{/if}
		</p>
		<a
			href="/"
			class="mt-6 inline-block rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
		>
			Go Home
		</a>
	</div>
</div>
