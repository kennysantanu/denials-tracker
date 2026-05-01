<script lang="ts">
	import { enhance } from '$app/forms';
	import { toastSuccess, toastError } from '$lib/toast';
	import { untrack } from 'svelte';

	const DEFAULT_CHAT_PROMPT =
		'You are a helpful medical billing assistant for a denials tracking application. You help users understand denial claims, generate appeal letters, and analyze billing data. Be concise and professional. When generating appeal letters, use a formal business letter format. Always base your responses on the actual data provided through tool calls.';

	const DEFAULT_REWRITE_PROMPT =
		'You are a professional medical billing assistant. Rewrite the following note to be clear, concise, and professional. Use proper medical billing terminology where appropriate. Return only the rewritten note text, with no explanations, prefixes, or surrounding quotes.';

	let { data } = $props();

	const initialData = untrack(() => ({
		aiBaseUrl: data.aiBaseUrl,
		aiModelName: data.aiModelName,
		idleTimeoutMinutes: data.idleTimeoutMinutes,
		aiChatSystemPrompt: data.aiChatSystemPrompt,
		aiRewriteSystemPrompt: data.aiRewriteSystemPrompt
	}));
	let aiBaseUrl = $state(initialData.aiBaseUrl ?? '');
	let aiModelName = $state(initialData.aiModelName ?? '');
	let idleTimeout = $state(initialData.idleTimeoutMinutes ?? 15);
	let aiChatPrompt = $state(initialData.aiChatSystemPrompt ?? '');
	let aiRewritePrompt = $state(initialData.aiRewriteSystemPrompt ?? '');

	function handleResult() {
		return ({ result }: any) => {
			if (result.type === 'success') {
				toastSuccess('Preference saved');
			} else if (result.type === 'failure') {
				toastError(result.data?.error ?? 'Failed to save preference');
			}
		};
	}
</script>

<svelte:head>
	<title>System Preferences — Denials Tracker</title>
</svelte:head>

<div class="space-y-6">
	<header>
		<h2 class="text-xl font-semibold text-surface-900">System Preferences</h2>
		<p class="text-sm text-surface-500">
			Workspace-wide defaults for security, AI, and other system behavior.
		</p>
	</header>

	<!-- Session Timeout Section -->
	<section class="card border border-surface-200 bg-white p-6 shadow-sm">
		<h3 class="mb-4 text-lg font-semibold text-surface-900">Session timeout (HIPAA)</h3>
		<div class="mb-4 rounded-base border-l-4 border-warning-500 bg-warning-50 p-3">
			<p class="text-sm text-surface-800">
				Auto-logout protects PHI by ending idle sessions. The maximum allowed value is
				<strong>{data.maxIdleTimeout} minutes</strong> (set by server environment). Industry standard
				for healthcare is 15–30 minutes.
			</p>
		</div>

		<form
			method="POST"
			action="?/saveIdleTimeout"
			use:enhance={() =>
				async ({ result, update }) => {
					handleResult()({ result });
					await update();
				}}
			class="flex flex-col gap-3 sm:flex-row sm:items-end"
		>
			<label class="label flex-1">
				<span class="label-text">Idle timeout (minutes)</span>
				<input
					id="idle_timeout_minutes"
					name="idle_timeout_minutes"
					type="number"
					min="1"
					max={data.maxIdleTimeout}
					bind:value={idleTimeout}
					class="input max-w-xs"
				/>
				<span class="text-xs text-surface-500">
					Range: 1–{data.maxIdleTimeout} minutes (max set by
					<code>SESSION_TIMEOUT_MINUTES</code>, up to 1440 / 24 h). Default: 15. Users see a
					2-minute warning before auto-signout.
				</span>
			</label>
			<button type="submit" class="btn preset-filled-primary-500 btn-sm">Save</button>
		</form>
	</section>

	<!-- AI Configuration Section -->
	<section class="card border border-surface-200 bg-white p-6 shadow-sm">
		<div class="mb-4 flex items-center justify-between gap-3">
			<h3 class="text-lg font-semibold text-surface-900">AI configuration</h3>
			{#if aiBaseUrl && aiModelName}
				<span class="badge preset-tonal-success">● AI enabled</span>
			{:else}
				<span class="badge preset-tonal-surface">○ AI disabled</span>
			{/if}
		</div>
		<div class="mb-4 rounded-base border-l-4 border-primary-500 bg-primary-50 p-3">
			<p class="text-sm text-surface-800">
				AI features connect to a <strong>local AI server only</strong> (e.g. LM Studio, Ollama). No data
				is sent to external cloud services.
			</p>
		</div>

		<form
			method="POST"
			action="?/saveAIConfig"
			use:enhance={() =>
				async ({ result, update }) => {
					handleResult()({ result });
					await update();
				}}
			class="space-y-4"
		>
			<label class="label">
				<span class="label-text">AI base URL</span>
				<input
					id="ai_base_url"
					name="ai_base_url"
					type="url"
					bind:value={aiBaseUrl}
					placeholder="http://localhost:1234/v1"
					class="input"
				/>
				<span class="text-xs text-surface-500">
					Full OpenAI-compatible base URL — e.g. <code>http://localhost:1234/v1</code> (LM Studio)
					or <code>http://localhost:11434/v1</code> (Ollama).
				</span>
			</label>
			<label class="label">
				<span class="label-text">AI model name</span>
				<input
					id="ai_model_name"
					name="ai_model_name"
					type="text"
					bind:value={aiModelName}
					placeholder="local-model"
					class="input"
				/>
				<span class="text-xs text-surface-500">
					Model identifier as configured in your local AI server.
				</span>
			</label>
			<div>
				<button type="submit" class="btn preset-filled-primary-500 btn-sm">
					Save AI settings
				</button>
			</div>
		</form>

		<!-- AI System Prompts -->
		<div class="mt-6 space-y-6 border-t border-surface-200 pt-6">
			<div>
				<h4 class="text-base font-semibold text-surface-900">System prompts</h4>
				<p class="text-xs text-surface-500">
					Customize the instructions sent to the AI. Leave blank to use the built-in default.
				</p>
			</div>

			<!-- Chat assistant prompt -->
			<form
				method="POST"
				action="?/saveAIChatPrompt"
				use:enhance={() =>
					async ({ result, update }) => {
						handleResult()({ result });
						await update();
					}}
				class="space-y-2"
			>
				<label class="label">
					<span class="label-text">Chat assistant prompt</span>
					<textarea
						id="ai_chat_system_prompt"
						name="ai_chat_system_prompt"
						bind:value={aiChatPrompt}
						rows="5"
						placeholder={DEFAULT_CHAT_PROMPT}
						class="textarea font-mono"
					></textarea>
				</label>
				<div class="flex items-center gap-2">
					<button type="submit" class="btn preset-filled-primary-500 btn-sm">Save</button>
					{#if aiChatPrompt}
						<button
							type="button"
							class="btn preset-tonal btn-sm"
							onclick={() => (aiChatPrompt = '')}
						>
							Reset to default
						</button>
					{/if}
				</div>
			</form>

			<!-- Rewrite prompt -->
			<form
				method="POST"
				action="?/saveAIRewritePrompt"
				use:enhance={() =>
					async ({ result, update }) => {
						handleResult()({ result });
						await update();
					}}
				class="space-y-2"
			>
				<label class="label">
					<span class="label-text">Note rewrite prompt</span>
					<textarea
						id="ai_rewrite_system_prompt"
						name="ai_rewrite_system_prompt"
						bind:value={aiRewritePrompt}
						rows="4"
						placeholder={DEFAULT_REWRITE_PROMPT}
						class="textarea font-mono"
					></textarea>
				</label>
				<div class="flex items-center gap-2">
					<button type="submit" class="btn preset-filled-primary-500 btn-sm">Save</button>
					{#if aiRewritePrompt}
						<button
							type="button"
							class="btn preset-tonal btn-sm"
							onclick={() => (aiRewritePrompt = '')}
						>
							Reset to default
						</button>
					{/if}
				</div>
			</form>
		</div>
	</section>

	<!-- Other Preferences -->
	<section class="space-y-3">
		<h3 class="text-lg font-semibold text-surface-900">Other preferences</h3>
		{#if data.preferences.length === 0}
			<div class="rounded-container border-2 border-dashed border-surface-200 p-8 text-center">
				<p class="text-sm text-surface-500">No other system preferences found.</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each data.preferences as pref (pref.id)}
					<form
						method="POST"
						action="?/setPreference"
						use:enhance={() =>
							async ({ result, update }) => {
								handleResult()({ result });
								await update();
							}}
						class="card border border-surface-200 bg-white p-4 shadow-sm"
					>
						<input type="hidden" name="name" value={pref.name} />
						<input type="hidden" name="data_type" value={pref.data_type ?? 'string'} />
						<div class="flex flex-col gap-3 sm:flex-row sm:items-end">
							<label class="label flex-1" for="pref-{pref.id}">
								<span class="label-text">{pref.name}</span>
								<input
									id="pref-{pref.id}"
									name="value"
									type="text"
									value={pref.value ?? ''}
									class="input"
								/>
								<span class="text-xs text-surface-500">
									Type: <code>{pref.data_type ?? 'string'}</code>
								</span>
							</label>
							<button type="submit" class="btn preset-filled-primary-500 btn-sm"> Save </button>
						</div>
					</form>
				{/each}
			</div>
		{/if}
	</section>
</div>
