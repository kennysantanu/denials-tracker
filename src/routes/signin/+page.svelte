<script lang="ts">
</script>

<div class="flex flex-col items-center">
	<!-- Page Content -->
	<div class="flex max-w-7xl flex-col items-center space-y-16 px-4">
		<!-- Sign In Card -->
		<div class="card w-full px-8 py-8">
			<!-- Sign In Form -->
			<form class="flex flex-col space-y-8">
				<label class="label">
					<span class="text-tertiary-500">Username</span>
					<input type="text" id="username" class="input" placeholder="Enter your username" />
				</label>
				<label class="label">
					<span class="text-tertiary-500">Password</span>
					<input type="password" id="password" class="input" placeholder="Enter your password" />
				</label>
				<div class="flex justify-between">
					<button type="submit" class="variant-filled-primary btn">Sign In</button>
					<a href="/" class="variant-filled-secondary btn">Cancel</a>
				</div>
			</form>
		</div>
	</div>
</div>
