<script lang="ts">
	import type { Component } from 'svelte';

	interface Props {
		title: string;
		value: string | number;
		sub?: string;
		accent?: string;
		icon?: Component<any>;
		iconColor?: string;
		iconBg?: string;
	}

	let { title, value, sub = '', accent = 'text-gray-900 dark:text-slate-100', icon: Icon, iconColor = 'text-gray-500 dark:text-slate-300', iconBg = 'bg-gray-100 dark:bg-slate-800/40' }: Props = $props();
</script>

<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 md:p-5 shadow-sm dark:shadow-lg hover:shadow-md dark:hover:shadow-xl transition">
	<div class="flex items-center justify-between">
		<div>
			<p class="text-sm text-gray-700 dark:text-slate-300 mb-1">{title}</p>
			<p class={`text-2xl md:text-3xl font-bold ${accent}`}>{value}</p>
			{#if sub}
				<p class="text-xs text-gray-600 dark:text-slate-400 mt-1">{sub}</p>
			{/if}
		</div>
		{#if Icon}
			<div class={`w-12 h-12 ${iconBg} rounded-full flex items-center justify-center`}>
				<Icon class={`w-6 h-6 ${iconColor}`} />
			</div>
		{/if}
	</div>
</div>
