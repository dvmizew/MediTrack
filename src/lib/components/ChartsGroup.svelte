<script lang="ts">
	import { TrendingUp } from '@lucide/svelte';
	export let weeklyCanvas: HTMLCanvasElement | null = null;
</script>

<div class="grid grid-cols-1 gap-4 md:gap-6">
	<!-- 7-day timeline Chart -->
	<div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg p-4 md:p-6">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2"><TrendingUp class="w-5 h-5" /> Evoluția Ultimelor 7 Zile</h3>
		<div class="h-64" role="img" aria-label="Evoluția ultimelor 7 zile - diagramă">
			<canvas bind:this={weeklyCanvas} aria-hidden="true"></canvas>
		</div>
	</div>
</div>