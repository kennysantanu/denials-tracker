<script lang="ts">
	import { enhance } from '$app/forms';
	import { toastSuccess, toastError } from '$lib/toast';

	let { data } = $props();

	let showAddForm = $state(false);
	let editingId = $state<number | null>(null);

	// Add form state
	let newRoleName = $state('');
	let newKeys = $state<Record<string, boolean>>({});

	// Edit form state
	let editRoleName = $state('');
	let editKeys = $state<Record<string, boolean>>({});

	// Group catalog entries by category for the picker.
	const catalogByCategory = $derived(
		(() => {
			const m = new Map<string, typeof data.catalog>();
			for (const c of data.catalog) {
				if (!m.has(c.category)) m.set(c.category, []);
				m.get(c.category)!.push(c);
			}
			return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
		})()
	);

	function startEdit(role: (typeof data.roles)[number]) {
		editingId = role.id;
		editRoleName = role.role_name ?? '';
		editKeys = Object.fromEntries(role.canonicalKeys.map((k) => [k, true]));
	}

	function cancelEdit() {
		editingId = null;
	}

	function resetAddForm() {
		newRoleName = '';
		newKeys = {};
	}

	function selectedKeysCsv(map: Record<string, boolean>): string {
		return Object.entries(map)
			.filter(([, v]) => v)
			.map(([k]) => k)
			.join(',');
	}

	function handleResult(action: string) {
		return ({ result }: { result: { type: string; data?: { error?: string } } }) => {
			if (result.type === 'success') {
				toastSuccess(`Role ${action} successfully`);
				showAddForm = false;
				editingId = null;
				resetAddForm();
			} else if (result.type === 'failure') {
				toastError(result.data?.error ?? `Failed to ${action} role`);
			}
		};
	}
</script>

<svelte:head>
	<title>Manage Roles | Denials Tracker</title>
</svelte:head>

<div class="space-y-6">
	<header class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 class="text-xl font-semibold text-surface-900">Roles</h2>
			<p class="text-sm text-surface-500">
				Define roles and the canonical permissions granted to users assigned to them.
			</p>
		</div>
		<button
			type="button"
			onclick={() => {
				showAddForm = !showAddForm;
				resetAddForm();
			}}
			class="btn btn-sm {showAddForm ? 'preset-tonal' : 'preset-filled-primary-500'}"
		>
			{showAddForm ? 'Cancel' : 'Add role'}
		</button>
	</header>

	{#if showAddForm}
		<form
			method="POST"
			action="?/createRole"
			use:enhance={() =>
				async ({ result, update }) => {
					handleResult('created')({ result });
					await update();
				}}
			class="card bg-surface-50 p-4"
		>
			<input type="hidden" name="keys" value={selectedKeysCsv(newKeys)} />

			<label class="label max-w-sm">
				<span class="label-text">Role name</span>
				<input
					id="role_name"
					name="role_name"
					type="text"
					required
					bind:value={newRoleName}
					class="input"
				/>
			</label>

			<fieldset class="mt-4 space-y-4">
				<legend class="text-sm font-medium text-surface-700">Permissions</legend>
				<p class="text-xs text-surface-500">
					<span class="badge preset-tonal-primary text-[10px]">new</span>
					= no v2 equivalent.
					<span class="badge preset-tonal-warning ml-2 text-[10px]">legacy-mapped</span>
					= dual-writes a v2 permission for transition.
				</p>
				{#each catalogByCategory as [category, entries] (category)}
					<div>
						<h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-600">
							{category}
						</h4>
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
							{#each entries as entry (entry.key)}
								<label class="flex items-start gap-2 text-sm text-surface-700">
									<input
										type="checkbox"
										bind:checked={newKeys[entry.key]}
										class="checkbox mt-0.5"
									/>
									<span>
										<span class="flex flex-wrap items-center gap-1">
											<code class="text-xs">{entry.key}</code>
											<span
												class="badge text-[10px] {entry.kind === 'legacy-mapped'
													? 'preset-tonal-warning'
													: 'preset-tonal-primary'}"
												title={entry.kind === 'legacy-mapped'
													? `Maps to legacy: ${entry.legacyKeys.join(', ')}`
													: 'No v2 equivalent'}
											>
												{entry.kind}
											</span>
										</span>
										{#if entry.description}
											<span class="block text-xs text-surface-500">{entry.description}</span>
										{/if}
									</span>
								</label>
							{/each}
						</div>
					</div>
				{/each}
			</fieldset>

			<div class="mt-4 flex justify-end gap-2">
				<button
					type="button"
					class="btn preset-tonal btn-sm"
					onclick={() => {
						showAddForm = false;
						resetAddForm();
					}}
				>
					Cancel
				</button>
				<button type="submit" class="btn preset-filled-primary-500 btn-sm"> Create role </button>
			</div>
		</form>
	{/if}

	<div class="card border border-surface-200 bg-white p-0 shadow-sm">
		<div class="table-wrap">
			<table class="table caption-bottom">
				<thead>
					<tr>
						<th>Role</th>
						<th>Permissions</th>
						<th class="w-32 text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.roles as role (role.id)}
						{#if editingId === role.id}
							<tr>
								<td colspan="3">
									<form
										method="POST"
										action="?/updateRole"
										use:enhance={() =>
											async ({ result, update }) => {
												handleResult('updated')({ result });
												await update();
											}}
										class="space-y-4"
									>
										<input type="hidden" name="id" value={role.id} />
										<input type="hidden" name="keys" value={selectedKeysCsv(editKeys)} />

										<label class="label max-w-sm">
											<span class="label-text">Role name</span>
											<input
												id="edit-role-name"
												name="role_name"
												type="text"
												bind:value={editRoleName}
												class="input"
											/>
										</label>

										<fieldset class="space-y-4">
											<legend class="text-sm font-medium text-surface-700">Permissions</legend>
											{#each catalogByCategory as [category, entries] (category)}
												<div>
													<h4
														class="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-600"
													>
														{category}
													</h4>
													<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
														{#each entries as entry (entry.key)}
															<label class="flex items-start gap-2 text-sm text-surface-700">
																<input
																	type="checkbox"
																	bind:checked={editKeys[entry.key]}
																	class="checkbox mt-0.5"
																/>
																<span>
																<span class="flex flex-wrap items-center gap-1">
																	<code class="text-xs">{entry.key}</code>
																	<span
																		class="badge text-[10px] {entry.kind === 'legacy-mapped'
																			? 'preset-tonal-warning'
																			: 'preset-tonal-primary'}"
																		title={entry.kind === 'legacy-mapped'
																			? `Maps to legacy: ${entry.legacyKeys.join(', ')}`
																			: 'No v2 equivalent'}
																	>
																		{entry.kind}
																	</span>
																</span>
																{#if entry.description}
																	<span class="block text-xs text-surface-500">
																		{entry.description}
																	</span>
																{/if}
															</span>
														</label>
													{/each}
												</div>
											</div>
										{/each}
									</fieldset>

									<div class="flex justify-end gap-2">
										<button
											type="button"
											onclick={() => cancelEdit()}
											class="btn preset-tonal btn-sm"
										>
											Cancel
										</button>
										<button type="submit" class="btn preset-filled-primary-500 btn-sm">
											Save
										</button>
									</div>
								</form>
							</td>
						</tr>
						{:else}
							<tr>
								<td class="font-medium text-surface-900">{role.role_name}</td>
								<td>
									{#if role.canonicalKeys.length === 0}
										<span class="text-surface-400">—</span>
									{:else}
										<div class="flex flex-wrap gap-1">
											{#each role.canonicalKeys as p (p)}
												<span class="badge preset-tonal-primary text-xs">{p}</span>
											{/each}
										</div>
									{/if}
								</td>
								<td>
									<div class="flex justify-end gap-2">
										<button
											type="button"
											onclick={() => startEdit(role)}
											class="btn preset-tonal-primary btn-sm"
										>
											Edit
										</button>
										<form
											method="POST"
											action="?/deleteRole"
											use:enhance={() =>
												async ({ result, update }) => {
													handleResult('deleted')({ result });
													await update();
												}}
										>
											<input type="hidden" name="id" value={role.id} />
											<button
												type="submit"
												onclick={(e) => {
													if (!confirm('Delete this role?')) e.preventDefault();
												}}
												class="btn preset-tonal-error btn-sm"
											>
												Delete
											</button>
										</form>
									</div>
								</td>
							</tr>
						{/if}
					{:else}
						<tr>
							<td colspan="3">
								<div
									class="rounded-container border-2 border-dashed border-surface-200 p-8 text-center"
								>
									<p class="text-sm text-surface-500">No roles yet.</p>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

