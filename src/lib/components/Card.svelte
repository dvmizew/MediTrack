<script lang="ts">
	export let title: string;
	export let value: string | number;
	export let sub: string = '';
	export let accent: string = 'text-gray-900 dark:text-gray-100';
	export let iconPath: string | null = null;
	export let iconColor: string = 'text-gray-500 dark:text-gray-400';
	export let iconBg: string = 'bg-gray-100 dark:bg-gray-800/30';
</script>

<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 md:p-5 shadow-sm hover:shadow-md transition">
	<div class="flex items-center justify-between">
		<div>
			<p class="text-sm text-black dark:text-slate-300 mb-1">{title}</p>
			<p class={`text-2xl md:text-3xl font-bold ${accent}`}>{value}</p>
			{#if sub}
				<p class="text-xs text-black/80 dark:text-slate-400 mt-1">{sub}</p>
			{/if}
		</div>
		{#if iconPath}
			<div class={`w-12 h-12 ${iconBg} rounded-full flex items-center justify-center`}>
				<svg class={`w-6 h-6 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={iconPath} />
				</svg>
			</div>
		{/if}
	</div>
</div>
