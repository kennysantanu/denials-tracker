<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import ToastHost from '$lib/components/ToastHost.svelte';

	let { data, children } = $props();

	onMount(() => {
		const {
			data: { subscription }
		} = data.supabase.auth.onAuthStateChange((_event: string, _session: unknown) => {
			invalidate('supabase:auth');
		});

		return () => subscription.unsubscribe();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Denials Tracker</title>
</svelte:head>
{@render children()}
<ToastHost />
