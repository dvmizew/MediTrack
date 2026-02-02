<script lang="ts">
	import { FileText, FilePlus, ChevronRight } from '@lucide/svelte';
	export let loading: boolean = false;
	export let treatments: Array<any> = [];
	export let onView: (planId: number) => void;
</script>

<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg overflow-hidden">
	<div class="p-4 md:p-6 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
		<h3 class="text-base md:text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2"><FileText class="w-5 h-5" /> Tratamente Recente</h3>
		<slot name="actions"></slot>
	</div>

	{#if loading}
		<div class="flex justify-center py-12">
			<div class="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent"></div>
		</div>
	{:else if treatments.length === 0}
		<div class="p-12 text-center">
			<FilePlus class="w-16 h-16 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
			<p class="text-gray-500 dark:text-slate-400">Nu ai tratamente create încă</p>
		</div>
	{:else}
		<div class="divide-y divide-gray-100 dark:divide-gray-700">
			{#each treatments as treatment}
				<button type="button" onclick={() => onView(treatment.planId)} class="w-full p-4 md:p-5 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition text-left">
					<div class="flex items-center justify-between">
						<div class="flex-1">
							<div class="flex items-center gap-2 mb-1">
								<h4 class="font-semibold text-gray-900 dark:text-slate-100">{treatment.diagnosis}</h4>
								<span class="px-2 py-1 text-xs font-medium rounded-full {treatment.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400'}">
									{treatment.isActive ? 'Activ' : 'Inactiv'}
								</span>
							</div>
							<p class="text-sm text-gray-500 dark:text-slate-400">Pacient: {treatment.patientName}</p>
							<p class="text-xs text-gray-400 dark:text-slate-500 mt-1">
								{new Date(treatment.createdAt).toLocaleDateString('ro-RO')}
							</p>
						</div>
						<ChevronRight class="w-5 h-5 text-gray-400 flex-shrink-0" />
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
