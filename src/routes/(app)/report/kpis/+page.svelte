<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let { data } = $props();

	type Scope = 'self' | 'team' | 'all';

	const scope = $derived(data.scope as Scope);
	const days = $derived(data.days);
	const userRows = $derived(data.userRows);
	const userLookup = $derived(data.userLookup as Record<string, string>);
	const roleRows = $derived(data.roleRows);
	const permUsage = $derived(data.permUsage);
	const authDenials = $derived(data.authDenials);
	const availableScopes = $derived(data.availableScopes);

	function setParam(name: string, value: string) {
		const url = new URL(page.url);
		url.searchParams.set(name, value);
		goto(url.toString(), { replaceState: true, keepFocus: true });
	}

	const totals = $derived.by(() => {
		const t = {
			events_total: 0,
			denials_worked: 0,
			denials_created: 0,
			denials_closed: 0,
			notes_created: 0,
			files_uploaded: 0,
			ai_invocations: 0,
			auth_denials: 0
		};
		for (const r of userRows) {
			t.events_total += r.events_total ?? 0;
			t.denials_worked += r.denials_worked ?? 0;
			t.denials_created += r.denials_created ?? 0;
			t.denials_closed += r.denials_closed ?? 0;
			t.notes_created += r.notes_created ?? 0;
			t.files_uploaded += r.files_uploaded ?? 0;
			t.ai_invocations += r.ai_invocations ?? 0;
			t.auth_denials += r.auth_denials ?? 0;
		}
		return t;
	});

	function displayUser(id: string): string {
		if (scope === 'self') return 'You';
		return userLookup[id] ?? id.slice(0, 8);
	}

	function outcomeBadgeClass(o: string): string {
		if (o === 'success') return 'badge preset-tonal-success';
		if (o === 'denied') return 'badge preset-tonal-error';
		return 'badge preset-tonal-warning';
	}
</script>

<div class="space-y-6">
	<nav class="text-sm text-surface-500">
		<a href="/report" class="hover:text-primary-600">Reports</a>
		<span class="mx-2">/</span>
		<span class="text-surface-700">KPIs</span>
	</nav>

	<header class="flex items-end justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold tracking-tight text-surface-900">KPI Dashboard</h1>
			<p class="text-sm text-surface-500">
				Activity, throughput, and authorization signals derived from <code>app_events</code>.
			</p>
		</div>
		<div class="flex items-end gap-2">
			<label class="label">
				<span class="label-text">Scope</span>
				<select
					class="select"
					value={scope}
					onchange={(e) => setParam('scope', (e.currentTarget as HTMLSelectElement).value)}
				>
					{#if availableScopes.self}
						<option value="self">Self</option>
					{/if}
					{#if availableScopes.team}
						<option value="team">Team</option>
					{/if}
					{#if availableScopes.all}
						<option value="all">All</option>
					{/if}
				</select>
			</label>
			<label class="label">
				<span class="label-text">Range</span>
				<select
					class="select"
					value={String(days)}
					onchange={(e) => setParam('days', (e.currentTarget as HTMLSelectElement).value)}
				>
					<option value="7">Last 7 days</option>
					<option value="30">Last 30 days</option>
					<option value="90">Last 90 days</option>
					<option value="365">Last 365 days</option>
				</select>
			</label>
		</div>
	</header>

	<!-- Summary tiles -->
	<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
		{#each [{ label: 'Events', value: totals.events_total }, { label: 'Denials worked', value: totals.denials_worked }, { label: 'Denials created', value: totals.denials_created }, { label: 'Denials closed', value: totals.denials_closed }, { label: 'Notes created', value: totals.notes_created }, { label: 'Files uploaded', value: totals.files_uploaded }, { label: 'AI invocations', value: totals.ai_invocations }, { label: 'Auth denials', value: totals.auth_denials }] as tile}
			<div class="card border border-surface-200 bg-white p-4 shadow-sm">
				<p class="text-xs tracking-wide text-surface-500 uppercase">{tile.label}</p>
				<p class="mt-1 text-2xl font-semibold text-surface-900">{tile.value}</p>
			</div>
		{/each}
	</div>

	<!-- Per-user/day table -->
	<section class="card border border-surface-200 bg-white p-6 shadow-sm">
		<header class="mb-4 flex items-end justify-between gap-4">
			<div>
				<h2 class="text-lg font-semibold text-surface-900">
					{scope === 'self' ? 'My daily activity' : 'User daily activity'}
				</h2>
				<p class="text-xs text-surface-500">One row per user per day in the selected range.</p>
			</div>
		</header>
		{#if userRows.length === 0}
			<div class="rounded-container border-2 border-dashed border-surface-200 p-8 text-center">
				<p class="text-sm text-surface-500">No activity in the selected range.</p>
			</div>
		{:else}
			<div class="table-wrap">
				<table class="table caption-bottom">
					<thead>
						<tr>
							<th>Day</th>
							{#if scope !== 'self'}<th>User</th>{/if}
							<th class="text-right">Worked</th>
							<th class="text-right">Created</th>
							<th class="text-right">Closed</th>
							<th class="text-right">Notes</th>
							<th class="text-right">Files</th>
							<th class="text-right">AI</th>
							<th class="text-right">Denials</th>
						</tr>
					</thead>
					<tbody class="[&>tr]:hover:preset-tonal-primary">
						{#each userRows as row}
							<tr>
								<td class="text-sm whitespace-nowrap text-surface-700">{row.day}</td>
								{#if scope !== 'self'}
									<td class="text-sm">{displayUser(row.user_id)}</td>
								{/if}
								<td class="text-right tabular-nums">{row.denials_worked}</td>
								<td class="text-right tabular-nums">{row.denials_created}</td>
								<td class="text-right tabular-nums">{row.denials_closed}</td>
								<td class="text-right tabular-nums">{row.notes_created}</td>
								<td class="text-right tabular-nums">{row.files_uploaded}</td>
								<td class="text-right tabular-nums">{row.ai_invocations}</td>
								<td class="text-right tabular-nums">
									{#if row.auth_denials > 0}
										<span class="badge preset-tonal-error">{row.auth_denials}</span>
									{:else}
										0
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<!-- Per-role/day table (team/all only) -->
	{#if scope !== 'self'}
		<section class="card border border-surface-200 bg-white p-6 shadow-sm">
			<header class="mb-4">
				<h2 class="text-lg font-semibold text-surface-900">Role daily activity</h2>
				<p class="text-xs text-surface-500">
					Users with multiple active roles contribute to each role they belong to.
				</p>
			</header>
			{#if roleRows.length === 0}
				<div class="rounded-container border-2 border-dashed border-surface-200 p-6 text-center">
					<p class="text-sm text-surface-500">No role activity in the selected range.</p>
				</div>
			{:else}
				<div class="table-wrap">
					<table class="table caption-bottom">
						<thead>
							<tr>
								<th>Day</th>
								<th>Role</th>
								<th class="text-right">Users</th>
								<th class="text-right">Events</th>
								<th class="text-right">Worked</th>
								<th class="text-right">Notes</th>
								<th class="text-right">Files</th>
								<th class="text-right">AI</th>
								<th class="text-right">Denials</th>
							</tr>
						</thead>
						<tbody class="[&>tr]:hover:preset-tonal-primary">
							{#each roleRows as row}
								<tr>
									<td class="text-sm whitespace-nowrap text-surface-700">{row.day}</td>
									<td class="text-sm font-medium">{row.role_name}</td>
									<td class="text-right tabular-nums">{row.active_users}</td>
									<td class="text-right tabular-nums">{row.events_total}</td>
									<td class="text-right tabular-nums">{row.denials_worked}</td>
									<td class="text-right tabular-nums">{row.notes_created}</td>
									<td class="text-right tabular-nums">{row.files_uploaded}</td>
									<td class="text-right tabular-nums">{row.ai_invocations}</td>
									<td class="text-right tabular-nums">
										{#if row.auth_denials > 0}
											<span class="badge preset-tonal-error">{row.auth_denials}</span>
										{:else}
											0
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	{/if}

	<!-- Admin-only: permission usage + authorization denials -->
	{#if availableScopes.all && scope === 'all'}
		<section class="card border border-surface-200 bg-white p-6 shadow-sm">
			<header class="mb-4">
				<h2 class="text-lg font-semibold text-surface-900">Permission usage</h2>
				<p class="text-xs text-surface-500">
					Top 500 permission-key / outcome buckets in the selected range.
				</p>
			</header>
			{#if permUsage.length === 0}
				<div class="rounded-container border-2 border-dashed border-surface-200 p-6 text-center">
					<p class="text-sm text-surface-500">No permission events recorded.</p>
				</div>
			{:else}
				<div class="table-wrap">
					<table class="table caption-bottom">
						<thead>
							<tr>
								<th>Day</th>
								<th>Permission</th>
								<th>Outcome</th>
								<th>Source</th>
								<th class="text-right">Events</th>
								<th class="text-right">Actors</th>
							</tr>
						</thead>
						<tbody class="[&>tr]:hover:preset-tonal-primary">
							{#each permUsage as row}
								<tr>
									<td class="text-sm whitespace-nowrap text-surface-700">{row.day}</td>
									<td class="font-mono text-xs">{row.permission_key}</td>
									<td><span class={outcomeBadgeClass(row.outcome)}>{row.outcome}</span></td>
									<td class="text-xs text-surface-500">{row.permission_source}</td>
									<td class="text-right tabular-nums">{row.event_count}</td>
									<td class="text-right tabular-nums">{row.distinct_actors}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>

		<section class="card border border-surface-200 bg-white p-6 shadow-sm">
			<header class="mb-4">
				<h2 class="text-lg font-semibold text-surface-900">Authorization denials</h2>
				<p class="text-xs text-surface-500">
					Per-user permission denials - watch for legitimate users routinely hitting the gate.
				</p>
			</header>
			{#if authDenials.length === 0}
				<div class="rounded-container border-2 border-dashed border-surface-200 p-6 text-center">
					<p class="text-sm text-surface-500">No authorization denials in the selected range.</p>
				</div>
			{:else}
				<div class="table-wrap">
					<table class="table caption-bottom">
						<thead>
							<tr>
								<th>Day</th>
								<th>User</th>
								<th>Permission</th>
								<th class="text-right">Denials</th>
								<th class="text-right">Resources</th>
								<th>Last denied</th>
							</tr>
						</thead>
						<tbody class="[&>tr]:hover:preset-tonal-primary">
							{#each authDenials as row}
								<tr>
									<td class="text-sm whitespace-nowrap text-surface-700">{row.day}</td>
									<td class="text-sm">
										{row.user_id ? displayUser(row.user_id) : '(anonymous)'}
									</td>
									<td class="font-mono text-xs">{row.permission_key ?? '(none)'}</td>
									<td class="text-right tabular-nums">
										<span class="badge preset-tonal-error">{row.denial_count}</span>
									</td>
									<td class="text-right tabular-nums">{row.distinct_resources}</td>
									<td class="text-xs text-surface-500">{row.last_denied_at}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	{/if}
</div>
