<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { AppBar, initializeStores, Modal, Drawer, getDrawerStore } from '@skeletonlabs/skeleton';
	import ChevronRight from '$lib/icons/Chevron-right.svelte';
	import XIcon from '$lib/icons/X-icon.svelte';
	import type { ModalComponent } from '@skeletonlabs/skeleton';

	// Import modal components
	import ModalInsurance from '$lib/modals/ModalInsurance.svelte';
	import ModalClaimSummary from '$lib/modals/ModalClaimSummary.svelte';
	import ModalAIAppeal from '$lib/modals/ModalAIAppeal.svelte';

	export let data;

	let { supabase, session } = data;
	$: ({ supabase, session } = data);

	initializeStores();

	// Register modal components
	const modalRegistry: Record<string, ModalComponent> = {
		modalInsurance: { ref: ModalInsurance },
		modalClaimSummary: { ref: ModalClaimSummary },
		modalAIAppeal: { ref: ModalAIAppeal }
	};

	// Initialize drawer store
	const drawerStore = getDrawerStore();
	$: classesActive = (href: string) =>
		$page.url.pathname.startsWith(href) ? '!variant-filled-primary' : '';

	onMount(() => {
		const { data } = supabase.auth.onAuthStateChange((event, _session) => {
			if (_session?.expires_at !== session?.expires_at) {
				invalidate('supabase:auth');
			}
		});

		return () => data.subscription.unsubscribe();
	});
</script>

<Modal components={modalRegistry} />

<Drawer regionDrawer="max-w-md">
	<AppBar gridColumns="grid-cols-3" slotDefault="place-self-center">
		<svelte:fragment slot="lead">
			<button class="btn" on:click={() => drawerStore.close()} aria-label="Open navigation menu">
				<XIcon />
			</button>
		</svelte:fragment>
		<h3 class="text-center font-bold text-tertiary-500">Denials Tracker</h3>
	</AppBar>

	<nav class="list-nav">
		<ul>
			<hr />
			<li class={classesActive('/record')}>
				<a
					href="/record"
					on:click={() => {
						drawerStore.close();
					}}
				>
					<span class="flex-auto">Record</span>
					<ChevronRight />
				</a>
			</li>
			<hr />
			<li class={classesActive('/report')}>
				<a
					href="/report"
					on:click={() => {
						drawerStore.close();
					}}
				>
					<span class="flex-auto">Report</span>
					<ChevronRight />
				</a>
			</li>
			<hr />
			<li class={classesActive('/file')}>
				<a
					href="/file"
					on:click={() => {
						drawerStore.close();
					}}
				>
					<span class="flex-auto">File</span>
					<ChevronRight />
				</a>
			</li>
			<hr />
			<li class={classesActive('/setting')}>
				<a
					href="/setting"
					on:click={() => {
						drawerStore.close();
					}}
				>
					<span class="flex-auto">Setting</span>
					<ChevronRight />
				</a>
			</li>
			<hr />
		</ul>
	</nav>
</Drawer>

<slot></slot>
