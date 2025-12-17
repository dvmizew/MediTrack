<script lang="ts">
	export let medication: any;
	export let isTaken: boolean;
	export let isSnoozed: boolean;
	export let onConfirm: (med: any) => void;
	export let onSnooze: (med: any) => void;
</script>

<div class={`p-4 md:p-5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 ${isTaken ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
	<div class="flex flex-col sm:flex-row justify-between items-start gap-3 md:gap-4">
		<div class="flex-1 min-w-0 w-full">
			<div class="flex items-start justify-between gap-2 mb-2">
				<h4 class="font-semibold text-gray-900 dark:text-gray-100 text-sm md:text-base">{medication.medicationName}</h4>
				<span class="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium whitespace-nowrap">
					🕐 {medication.time}
				</span>
			</div>
			<div class="space-y-1">
				<p class="text-xs md:text-sm text-gray-600 dark:text-gray-400">💊 Doza: <span class="font-medium">{medication.quantity}</span></p>
				<p class="text-xs md:text-sm text-gray-600 dark:text-gray-400">🔄 Frecvență: <span class="font-medium">{medication.frequency}</span></p>
				{#if medication.instructions}
					<p class="text-xs md:text-sm text-gray-500 dark:text-gray-500 mt-2 italic line-clamp-2">{medication.instructions}</p>
				{/if}
			</div>
		</div>

		<div class="flex sm:flex-col gap-2 w-full sm:w-auto">
			{#if isTaken}
				<span class="px-3 py-2 md:px-4 md:py-2 bg-green-500 text-white rounded-lg text-xs md:text-sm font-semibold shadow-sm flex items-center justify-center gap-2 whitespace-nowrap">
					<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
					</svg>
					Luat
				</span>
			{:else if isSnoozed}
				<div class="flex items-center gap-2 w-full sm:w-auto">
					<span class="px-3 py-2 md:px-4 md:py-2 bg-yellow-100 text-yellow-800 rounded-lg text-xs md:text-sm font-medium flex items-center justify-center gap-2 whitespace-nowrap">
						<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
						</svg>
						Amânat
					</span>
					<button onclick={() => onConfirm(medication)} class="flex-1 sm:flex-none px-3 py-2 md:px-4 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 text-xs md:text-sm font-medium shadow-sm transition touch-manipulation">✓ Confirmă</button>
				</div>
			{:else}
				<button onclick={() => onConfirm(medication)} class="flex-1 sm:flex-none px-3 py-2 md:px-4 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 text-xs md:text-sm font-medium shadow-sm transition touch-manipulation">✓ Confirmă</button>
				<button onclick={() => onSnooze(medication)} class="flex-1 sm:flex-none px-3 py-2 md:px-4 md:py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 text-xs md:text-sm font-medium transition touch-manipulation">⏰ Amână +30min</button>
			{/if}
		</div>
	</div>
</div>
