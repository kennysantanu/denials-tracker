<script lang="ts">
	interface Props {
		onclick: () => void;
	}

	let { onclick }: Props = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 bg-black/50 z-40"
	onclick={onclick}
	onkeydown={(e: KeyboardEvent) => {
		if (e.key === 'Escape') onclick();
	}}
	role="presentation"
></div>
