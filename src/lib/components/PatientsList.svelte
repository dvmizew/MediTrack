<script lang="ts">
	import { Users, UserPlus, ChevronRight } from '@lucide/svelte';
	export let loading: boolean = false;
	export let patients: Array<any> = [];
	export let onView: (userId: number) => void;
</script>

<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg overflow-hidden">
	<div class="p-4 md:p-6 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
		<h3 class="text-base md:text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2"><Users class="w-5 h-5" /> Pacienții Tăi</h3>
		<slot name="actions"></slot>
	</div>

	{#if loading}
		<div class="flex justify-center py-12">
			<div class="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent"></div>
		</div>
	{:else if patients.length === 0}
		<div class="p-12 text-center">
			<UserPlus class="w-16 h-16 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
			<p class="text-gray-500 dark:text-slate-400">Nu ai pacienți înregistrați încă</p>
		</div>
	{:else}
		<div class="divide-y divide-gray-100 dark:divide-gray-700">
			{#each patients as patient}
				<button type="button" onclick={() => onView(patient.user_id)} class="w-full p-4 md:p-5 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition text-left">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<div class="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
								{patient.name?.charAt(0).toUpperCase() || 'P'}
							</div>
							<div>
								<h4 class="font-semibold text-gray-900 dark:text-slate-100">{patient.name}</h4>
								<p class="text-sm text-gray-500 dark:text-slate-400">{patient.email}</p>
							</div>
						</div>
						<ChevronRight class="w-5 h-5 text-gray-400" />
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
