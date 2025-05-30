<script lang="ts">
	import '../app.css';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { initializeStores, Modal } from '@skeletonlabs/skeleton';
	import type { ModalComponent } from '@skeletonlabs/skeleton';

	// Import modal components
	import ModalInsurance from '$lib/modals/ModalInsurance.svelte';

	export let data;

	let { supabase, session } = data;
	$: ({ supabase, session } = data);

	initializeStores();

	// Register modal components
	const modalRegistry: Record<string, ModalComponent> = {
		modalInsurance: { ref: ModalInsurance }
	};

	onMount(() => {
		const { data } = supabase.auth.onAuthStateChange((event, _session) => {
			if (_session?.expires_at !== session?.expires_at) {
				invalidate('supabase:auth');
			}
		});

		return () => data.subscription.unsubscribe();
	});
</script>

<svelte:head>
	<title>Denials Tracker</title>
</svelte:head>

<Modal components={modalRegistry} />

<slot></slot>
