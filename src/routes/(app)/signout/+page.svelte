<script lang="ts">
	import { enhance } from '$app/forms';
</script>

<!-- This page auto-submits but provides a form for sign-out -->
<div class="flex min-h-[60vh] items-center justify-center">
	<form method="POST" use:enhance>
		<button type="submit" class="btn preset-filled-primary-500"> Sign Out </button>
	</form>
</div>
