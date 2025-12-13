<script lang="ts">
	export let loading: boolean = false;
	export let patients: Array<any> = [];
	export let onView: (userId: number) => void;
</script>

<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
	<div class="p-4 md:p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
		<h3 class="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">👥 Pacienții Tăi</h3>
		<slot name="actions"></slot>
	</div>

	{#if loading}
		<div class="flex justify-center py-12">
			<div class="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent"></div>
		</div>
	{:else if patients.length === 0}
		<div class="p-12 text-center">
			<svg class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
			</svg>
			<p class="text-gray-500 dark:text-gray-400">Nu ai pacienți înregistrați încă</p>
		</div>
	{:else}
		<div class="divide-y divide-gray-100 dark:divide-gray-700">
			{#each patients as patient}
				<button type="button" onclick={() => onView(patient.user_id)} class="w-full p-4 md:p-5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition text-left">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<div class="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
								{patient.name?.charAt(0).toUpperCase() || 'P'}
							</div>
							<div>
								<h4 class="font-semibold text-gray-900 dark:text-gray-100">{patient.name}</h4>
								<p class="text-sm text-gray-500 dark:text-gray-400">{patient.email}</p>
							</div>
						</div>
						<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
						</svg>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
