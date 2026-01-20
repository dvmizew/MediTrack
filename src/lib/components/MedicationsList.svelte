<script lang="ts">
	export let loading: boolean = false;
	export let medications: Array<any> = [];
	export let isTakenFn: (m: any) => boolean;
	export let isSnoozedFn: (m: any) => boolean;
	export let onConfirm: (m: any) => void;
	export let onSnooze: (m: any) => void;
  import MedicationItem from '$lib/components/MedicationItem.svelte';
</script>

<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
	<div class="p-4 md:p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800">
		<h3 class="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">📋 Medicamentele de astăzi</h3>
	</div>

	{#if loading}
		<div class="flex justify-center py-8 md:py-12">
			<div class="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent shadow-lg shadow-blue-500/50 animate-pulse"></div>
		</div>
	{:else if medications.length === 0}
		<div class="p-8 md:p-12 text-center">
			<svg class="w-12 h-12 md:w-16 md:h-16 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
			</svg>
			<p class="text-sm md:text-base text-gray-500 dark:text-gray-400">Nu ai medicamente programate astăzi</p>
		</div>
	{:else}
		<div class="divide-y divide-gray-100 dark:divide-gray-700">
			{#each medications as medication}
				<MedicationItem medication={medication} isTaken={isTakenFn(medication)} isSnoozed={isSnoozedFn(medication)} onConfirm={onConfirm} onSnooze={onSnooze} />
			{/each}
		</div>
	{/if}
</div>
