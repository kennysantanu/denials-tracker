<script lang="ts">
	import { formatDate } from '$lib/utils';
	import type { getRelatedClaims } from '$lib/server/db/files';

	type RelatedClaims = NonNullable<Awaited<ReturnType<typeof getRelatedClaims>>['data']>;

	interface Props {
		relatedClaims: RelatedClaims;
	}

	let { relatedClaims }: Props = $props();
</script>

{#if relatedClaims && relatedClaims.length > 0}
	<div class="card border border-surface-200 bg-white">
		<details class="space-y-4 p-6" open>
			<summary class="cursor-pointer text-lg font-semibold text-surface-800">
				Related Claims
			</summary>
			<div class="hidden table-wrap sm:block">
				<table class="table caption-bottom">
					<thead class="border-b border-surface-200 bg-surface-50">
						<tr>
							<th class="px-4 py-2 font-medium text-surface-700">Patient</th>
							<th class="px-4 py-2 font-medium text-surface-700">Date of Service</th>
							<th class="px-4 py-2 font-medium text-surface-700">Labels</th>
							<th class="px-4 py-2 font-medium text-surface-700">Last Note</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-surface-100">
						{#each relatedClaims as row (row.note_id)}
							{#if row.notes?.denials?.patients}
								<tr class="hover:bg-surface-50">
									<td class="px-4 py-3">
										<a
											href="/record/{row.notes.denials.patients.id}"
											class="text-primary-600 hover:underline"
										>
											{row.notes.denials.patients.last_name}, {row.notes.denials.patients
												.first_name}
											({formatDate(row.notes.denials.patients.date_of_birth)})
										</a>
									</td>
									<td class="px-4 py-3 font-medium text-surface-800">
										{formatDate(row.notes.denials.service_start_date)}
										{#if row.notes.denials.service_end_date}
											- {formatDate(row.notes.denials.service_end_date)}
										{/if}
									</td>
									<td class="px-4 py-3">
										<div class="flex flex-wrap gap-1">
											{#each row.notes.denials.denials_labels as dl, i (i)}
												{#if dl.labels}
													<span
														class="badge rounded-base"
														style="background-color: {dl.labels.bg_color}; color: {dl.labels
															.txt_color};"
													>
														{dl.labels.label_name}
													</span>
												{/if}
											{/each}
										</div>
									</td>
									<td class="px-4 py-3 text-surface-600">
										<span class="text-xs text-surface-400">
											({formatDate(row.notes.created_at)})
										</span>
										{#if row.notes.created_by}
											<span class="font-medium">{row.notes.created_by.username}:</span>
										{/if}
										<span class="line-clamp-2">{row.notes.note}</span>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Mobile card presentation -->
			<div class="space-y-3 sm:hidden">
				{#each relatedClaims as row (row.note_id)}
					{#if row.notes?.denials?.patients}
						<div class="rounded-base border border-surface-200 p-3">
							<a
								href="/record/{row.notes.denials.patients.id}"
								class="font-medium text-primary-600 hover:underline"
							>
								{row.notes.denials.patients.last_name}, {row.notes.denials.patients.first_name}
								({formatDate(row.notes.denials.patients.date_of_birth)})
							</a>
							<p class="mt-1 text-sm text-surface-700">
								{formatDate(row.notes.denials.service_start_date)}
								{#if row.notes.denials.service_end_date}
									- {formatDate(row.notes.denials.service_end_date)}
								{/if}
							</p>
							<div class="mt-2 flex flex-wrap gap-1">
								{#each row.notes.denials.denials_labels as dl, i (i)}
									{#if dl.labels}
										<span
											class="badge rounded-base"
											style="background-color: {dl.labels.bg_color}; color: {dl.labels.txt_color};"
										>
											{dl.labels.label_name}
										</span>
									{/if}
								{/each}
							</div>
							<p class="mt-2 text-sm text-surface-600">
								<span class="text-xs text-surface-400">
									({formatDate(row.notes.created_at)})
								</span>
								{#if row.notes.created_by}
									<span class="font-medium">{row.notes.created_by.username}:</span>
								{/if}
								<span class="line-clamp-2">{row.notes.note}</span>
							</p>
						</div>
					{/if}
				{/each}
			</div>
		</details>
	</div>
{/if}
