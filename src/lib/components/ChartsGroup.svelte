<script lang="ts">
	export let adherenceCanvas: HTMLCanvasElement | null = null;
	export let weeklyCanvas: HTMLCanvasElement | null = null;
	export let medicationsCanvas: HTMLCanvasElement | null = null;
</script>

<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
	<!-- Adherence Chart -->
	<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">📊 Conformitate Săptămânală</h3>
		<div class="h-64">
			<canvas bind:this={adherenceCanvas}></canvas>
		</div>
	</div>

	<!-- 7-day timeline Chart -->
	<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">📈 Evoluția Ultimelor 7 Zile</h3>
		<div class="h-64">
			<canvas bind:this={weeklyCanvas}></canvas>
		</div>
	</div>

	<!-- Medications Distribution -->
	<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 lg:col-span-2">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">💊 Medicamente Săptămânal</h3>
		<div class="h-64">
			<canvas bind:this={medicationsCanvas}></canvas>
		</div>
	</div>
</div>
