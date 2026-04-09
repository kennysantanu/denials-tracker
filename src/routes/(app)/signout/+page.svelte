<script lang="ts">
	import { enhance } from '$app/forms';
</script>

<!-- This page auto-submits but provides a form for sign-out -->
<div class="flex min-h-[60vh] items-center justify-center">
	<form method="POST" use:enhance>
		<button
			type="submit"
			class="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
		>
			Sign Out
		</button>
	</form>
</div>
