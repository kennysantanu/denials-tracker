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
	<h2 class="text-xl font-semibold text-surface-900">System Preferences</h2>

	<!-- Session Timeout Section -->
	<div class="rounded-lg border border-surface-200 bg-white p-6">
		<h3 class="mb-4 text-lg font-semibold text-surface-900">Session Timeout (HIPAA)</h3>
		<div class="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3">
			<p class="text-sm text-amber-800">
				Auto-logout protects PHI by ending idle sessions. The maximum allowed value is
				<strong>{data.maxIdleTimeout} minutes</strong> (set by server environment). Industry standard
				for healthcare is 15–30 minutes.
			</p>
		</div>

		<form
			method="POST"
			action="?/saveIdleTimeout"
			use:enhance={() => {
				return async ({ result, update }) => {
					handleResult()({ result });
					await update();
				};
			}}
			class="flex items-end gap-4"
		>
			<div class="flex-1">
				<label for="idle_timeout_minutes" class="mb-1 block text-sm font-medium text-surface-700">
					Idle Timeout (minutes)
				</label>
				<input
					id="idle_timeout_minutes"
					name="idle_timeout_minutes"
					type="number"
					min="1"
					max={data.maxIdleTimeout}
					bind:value={idleTimeout}
					class="w-full max-w-xs rounded-md border border-surface-300 px-3 py-2 text-sm"
				/>
				<p class="mt-1 text-xs text-surface-500">
					Range: 1–{data.maxIdleTimeout} minutes (max set by <code>SESSION_TIMEOUT_MINUTES</code> env
					var, up to 1440 min / 24 h). Default: 15. Users will see a 2-minute warning before auto-signout.
				</p>
			</div>
			<button
				type="submit"
				class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
			>
				Save
			</button>
		</form>
	</div>

	<!-- AI Configuration Section -->
	<div class="rounded-lg border border-surface-200 bg-white p-6">
		<h3 class="mb-4 text-lg font-semibold text-surface-900">AI Configuration</h3>
		<div class="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
			<p class="text-sm text-blue-800">
				AI features connect to a <strong>local AI server only</strong> (e.g. LM Studio, Ollama). No data
				is sent to external cloud services. Configure the base URL and model name of your local AI server
				below.
			</p>
		</div>

		<form
			method="POST"
			action="?/saveAIConfig"
			use:enhance={() => {
				return async ({ result, update }) => {
					handleResult()({ result });
					await update();
				};
			}}
			class="space-y-4"
		>
			<div>
				<label for="ai_base_url" class="mb-1 block text-sm font-medium text-surface-700">
					AI Base URL
				</label>
				<input
					id="ai_base_url"
					name="ai_base_url"
					type="url"
					bind:value={aiBaseUrl}
					placeholder="http://localhost:1234/v1"
					class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm"
				/>
				<p class="mt-1 text-xs text-surface-500">
					Full OpenAI-compatible base URL including path prefix — e.g.
					<code>http://localhost:1234/v1</code> (LM Studio),
					<code>http://localhost:11434/v1</code> (Ollama). Trailing slash is optional.
				</p>
			</div>
			<div>
				<label for="ai_model_name" class="mb-1 block text-sm font-medium text-surface-700">
					AI Model Name
				</label>
				<input
					id="ai_model_name"
					name="ai_model_name"
					type="text"
					bind:value={aiModelName}
					placeholder="local-model"
					class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm"
				/>
				<p class="mt-1 text-xs text-surface-500">
					Model identifier as configured in your local AI server
				</p>
			</div>
			<div class="flex items-center gap-3">
				<button
					type="submit"
					class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
				>
					Save AI Settings
				</button>
				{#if aiBaseUrl && aiModelName}
					<span class="text-xs text-success-600">● AI Enabled</span>
				{:else}
					<span class="text-xs text-surface-400">○ AI Disabled (both fields required)</span>
				{/if}
			</div>
		</form>

		<!-- AI System Prompts -->
		<div class="mt-6 space-y-6 border-t border-surface-200 pt-6">
			<h4 class="text-base font-semibold text-surface-800">System Prompts</h4>
			<p class="-mt-4 text-xs text-surface-500">
				Customize the instructions sent to the AI. Leave blank to use the built-in default.
			</p>

			<!-- Chat assistant prompt -->
			<form
				method="POST"
				action="?/saveAIChatPrompt"
				use:enhance={() => {
					return async ({ result, update }) => {
						handleResult()({ result });
						await update();
					};
				}}
				class="space-y-2"
			>
				<label for="ai_chat_system_prompt" class="block text-sm font-medium text-surface-700">
					Chat Assistant Prompt
				</label>
				<textarea
					id="ai_chat_system_prompt"
					name="ai_chat_system_prompt"
					bind:value={aiChatPrompt}
					rows="5"
					placeholder={DEFAULT_CHAT_PROMPT}
					class="w-full rounded-md border border-surface-300 px-3 py-2 font-mono text-sm placeholder:text-surface-300"
				></textarea>
				<div class="flex items-center gap-3">
					<button
						type="submit"
						class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
					>
						Save
					</button>
					{#if aiChatPrompt}
						<button
							type="button"
							class="text-sm text-surface-500 hover:text-surface-800 hover:underline"
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
				use:enhance={() => {
					return async ({ result, update }) => {
						handleResult()({ result });
						await update();
					};
				}}
				class="space-y-2"
			>
				<label for="ai_rewrite_system_prompt" class="block text-sm font-medium text-surface-700">
					Note Rewrite Prompt
				</label>
				<textarea
					id="ai_rewrite_system_prompt"
					name="ai_rewrite_system_prompt"
					bind:value={aiRewritePrompt}
					rows="4"
					placeholder={DEFAULT_REWRITE_PROMPT}
					class="w-full rounded-md border border-surface-300 px-3 py-2 font-mono text-sm placeholder:text-surface-300"
				></textarea>
				<div class="flex items-center gap-3">
					<button
						type="submit"
						class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
					>
						Save
					</button>
					{#if aiRewritePrompt}
						<button
							type="button"
							class="text-sm text-surface-500 hover:text-surface-800 hover:underline"
							onclick={() => (aiRewritePrompt = '')}
						>
							Reset to default
						</button>
					{/if}
				</div>
			</form>
		</div>
	</div>

	<!-- Other Preferences -->
	{#if data.preferences.length === 0}
		<p class="text-sm text-surface-500">No other system preferences found.</p>
	{:else}
		<div class="space-y-4">
			{#each data.preferences as pref (pref.id)}
				<form
					method="POST"
					action="?/setPreference"
					use:enhance={() => {
						return async ({ result, update }) => {
							handleResult()({ result });
							await update();
						};
					}}
					class="flex items-end gap-4 rounded-md border border-surface-200 bg-surface-50 p-4"
				>
					<input type="hidden" name="name" value={pref.name} />
					<input type="hidden" name="data_type" value={pref.data_type ?? 'string'} />
					<div class="flex-1">
						<label for="pref-{pref.id}" class="mb-1 block text-sm font-medium text-surface-700">
							{pref.name}
						</label>
						<p class="mb-2 text-xs text-surface-500">Type: {pref.data_type ?? 'string'}</p>
						<input
							id="pref-{pref.id}"
							name="value"
							type="text"
							value={pref.value ?? ''}
							class="w-full rounded-md border border-surface-300 px-3 py-2 text-sm"
						/>
					</div>
					<button
						type="submit"
						class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
					>
						Save
					</button>
				</form>
			{/each}
		</div>
	{/if}
</div>
