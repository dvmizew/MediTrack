<script lang="ts">
	import { BarChart3, TrendingUp, Pill } from '@lucide/svelte';
	export let adherenceCanvas: HTMLCanvasElement | null = null;
	export let weeklyCanvas: HTMLCanvasElement | null = null;
	export let medicationsCanvas: HTMLCanvasElement | null = null;
</script>

<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
	<!-- Adherence Chart -->
	<div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg p-4 md:p-6">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2"><BarChart3 class="w-5 h-5" /> Conformitate Săptămânală</h3>
		<div class="h-64" role="img" aria-label="Conformitate săptămânală - diagramă">
			<canvas bind:this={adherenceCanvas} aria-hidden="true"></canvas>
		</div>
	</div>

	<!-- 7-day timeline Chart -->
	<div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg p-4 md:p-6">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2"><TrendingUp class="w-5 h-5" /> Evoluția Ultimelor 7 Zile</h3>
		<div class="h-64" role="img" aria-label="Evoluția ultimelor 7 zile - diagramă">
			<canvas bind:this={weeklyCanvas} aria-hidden="true"></canvas>
		</div>
	</div>

	<!-- Medications Distribution -->
	<div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg p-4 md:p-6 lg:col-span-2">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2"><Pill class="w-5 h-5" /> Medicamente Săptămânal</h3>
		<div class="h-64" role="img" aria-label="Distribuție medicamente săptămânal - diagramă">
			<canvas bind:this={medicationsCanvas} aria-hidden="true"></canvas>
		</div>
	</div>
</div>
