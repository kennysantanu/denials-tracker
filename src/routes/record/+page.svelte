<script lang="ts">
	import Ellipsis from '$lib/icons/Ellipsis-vertical.svelte';
	import { Autocomplete } from '@skeletonlabs/skeleton';
	import { popup } from '@skeletonlabs/skeleton';
	import type { AutocompleteOption, PopupSettings } from '@skeletonlabs/skeleton';
</script>

<div class="flex flex-col items-center">
	<!-- Page Content -->
	<div class="flex max-w-7xl flex-col items-center space-y-16 px-4">
		<!-- Patient Card -->
		<div class="card w-full space-y-12 px-8 py-8">
			<label class="label">
				<span class="text-tertiary-500">Patient Select</span>
				<div class="flex flex-row space-x-8">
					<select class="select">
						<option value="1">Lastname, Firstname</option>
						<option value="2">Lastname, Firstname</option>
						<option value="3">Lastname, Firstname</option>
					</select>
					<button type="button" class="variant-filled-secondary btn">Add New Patient</button>
				</div>
			</label>
			<label class="label">
				<span class="text-tertiary-500">Note</span>
				<div class="flex flex-row space-x-4">
					<textarea class="textarea" rows="4" />
					<div>
						<button type="button" class="btn-icon text-tertiary-500">
							<Ellipsis />
						</button>
					</div>
				</div>
			</label>
		</div>

		<!-- Denial List -->
		<div class="space-y-8">
			<!-- Denial List Header -->
			<div class="flex flex-row items-end justify-between">
				Denial Records for Lastname, Firstname (x in total)
				<button type="button" class="btn font-bold text-tertiary-500">+ Add New Record</button>
			</div>

			<!-- Denial List Cards -->
			<div class="card space-y-8 px-8 py-8">
				<!-- Denial List Card Header -->
				<div class="flex flex-wrap justify-between">
					<div class="grid grid-rows-2">
						<span class="text-slate-500">Date of Service</span>
						01/01/2021 - 01/31/2021
					</div>
					<div class="grid grid-rows-2">
						<span class="text-slate-500">Bill Amount</span>
						$750.00
					</div>
					<div class="grid grid-rows-2">
						<span class="text-slate-500">Paid Amount</span>
						$420.69
					</div>
					<div class="grid grid-rows-2">
						<span class="text-slate-500">Labels</span>
						<div>
							<span class="variant-filled-success chip">Paid</span>
							<span class="variant-filled-warning chip">Appealed</span>
							<span class="variant-filled-error chip">Denied</span>
						</div>
					</div>
					<div>
						<button type="button" class="btn-icon text-tertiary-500">
							<Ellipsis />
						</button>
					</div>
				</div>
				<hr />
				<button type="button" class="btn text-tertiary-500">+ Add New Note</button>
				<div class="flex flex-row">
					<div>
						<span>(04/01/2024)</span>
						<span class="font-bold">username:</span>
						<span class="text-surface-800"
							>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean convallis lorem sed
							nulla tristique eleifend. Mauris lacinia dapibus magna, ut bibendum ex scelerisque eu.
							Sed a fermentum nulla. Nullam molestie erat non mauris mattis euismod. Mauris nec
							dolor ac ipsum viverra egestas sed ut risus. Nullam rhoncus dictum massa, vel
							condimentum risus scelerisque sed. Aliquam non orci sem. Nunc eget rhoncus est.</span
						>
					</div>
					<div>
						<button type="button" class="btn-icon text-surface-800">
							<Ellipsis />
						</button>
					</div>
				</div>
				<div class="flex flex-row">
					<div>
						<span>(04/01/2024)</span>
						<span class="font-bold">username:</span>
						<span class="text-surface-800"
							>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque
							laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi
							architecto beatae vitae dicta sunt explicabo.</span
						>
					</div>
					<div>
						<button type="button" class="btn-icon text-surface-800">
							<Ellipsis />
						</button>
					</div>
				</div>
				<div class="flex flex-row">
					<div>
						<span>(04/01/2024)</span>
						<span class="font-bold">username:</span>
						<span class="text-surface-800"
							>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia
							consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro
							quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed
							quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat
							voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis
							suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum
							iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur,
							vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?</span
						>
					</div>
					<div>
						<button type="button" class="btn-icon text-surface-800">
							<Ellipsis />
						</button>
					</div>
				</div>
			</div>

			<!-- Denial List Cards 2 -->
			<div class="card space-y-8 px-8 py-8">
				<!-- Denial List Card Header -->
				<div class="flex flex-wrap justify-between">
					<div class="grid grid-rows-2">
						<span class="text-slate-500">Date of Service</span>
						01/01/2020
					</div>
					<div class="grid grid-rows-2">
						<span class="text-slate-500">Bill Amount</span>
						$250.00
					</div>
					<div class="grid grid-rows-2">
						<span class="text-slate-500">Paid Amount</span>
						$$0.00
					</div>
					<div class="grid grid-rows-2">
						<span class="text-slate-500">Labels</span>
						<div>
							<span class="variant-filled-error chip">Denied</span>
						</div>
					</div>
					<div>
						<button type="button" class="btn-icon text-tertiary-500">
							<Ellipsis />
						</button>
					</div>
				</div>
				<hr />
				<button type="button" class="btn text-tertiary-500">+ Add New Note</button>
				<div class="flex flex-row">
					<div>
						<span>(04/01/2024)</span>
						<span class="font-bold">username:</span>
						<span class="text-surface-800"
							>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean convallis lorem sed
							nulla tristique eleifend. Mauris lacinia dapibus magna, ut bibendum ex scelerisque eu.
							Sed a fermentum nulla. Nullam molestie erat non mauris mattis euismod. Mauris nec
							dolor ac ipsum viverra egestas sed ut risus. Nullam rhoncus dictum massa, vel
							condimentum risus scelerisque sed. Aliquam non orci sem. Nunc eget rhoncus est.</span
						>
					</div>
					<div>
						<button type="button" class="btn-icon text-surface-800">
							<Ellipsis />
						</button>
					</div>
				</div>
				<div class="flex flex-row">
					<div>
						<span>(04/01/2024)</span>
						<span class="font-bold">username:</span>
						<span class="text-surface-800"
							>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque
							laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi
							architecto beatae vitae dicta sunt explicabo.</span
						>
					</div>
					<div>
						<button type="button" class="btn-icon text-surface-800">
							<Ellipsis />
						</button>
					</div>
				</div>
				<div class="flex flex-row">
					<div>
						<span>(04/01/2024)</span>
						<span class="font-bold">username:</span>
						<span class="text-surface-800"
							>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia
							consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro
							quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed
							quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat
							voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis
							suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum
							iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur,
							vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?</span
						>
					</div>
					<div>
						<button type="button" class="btn-icon text-surface-800">
							<Ellipsis />
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
