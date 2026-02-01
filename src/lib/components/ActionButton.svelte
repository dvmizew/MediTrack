<script lang="ts">
	import type { Component } from 'svelte';
	import { goto } from '$app/navigation';

	interface Props {
		href: string;
		label: string;
		description: string;
		icon: Component<any>;
		iconBg: string;
		iconColor: string;
		borderHover: string;
	}

	let { href, label, description, icon: Icon, iconBg, iconColor, borderHover }: Props = $props();
</script>

<button onclick={() => goto(href)} class={`bg-white dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-6 ${borderHover} shadow-sm dark:shadow-lg hover:shadow-md dark:hover:shadow-xl transition group`}>
	<div class="flex items-center gap-4">
		<div class={`w-12 h-12 ${iconBg} rounded-full flex items-center justify-center group-hover:scale-110 transition`}>
			<Icon class={`w-6 h-6 ${iconColor}`} />
		</div>
		<div class="text-left">
			<h3 class="font-semibold text-gray-900 dark:text-slate-100">{label}</h3>
			<p class="text-sm text-gray-500 dark:text-slate-400">{description}</p>
		</div>
	</div>
</button>
