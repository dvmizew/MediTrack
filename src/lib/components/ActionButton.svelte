<script lang="ts">
	export let href: string;
	export let label: string;
	export let description: string;
	export let iconPath: string;
	export let iconBg: string;
	export let iconColor: string;
	export let borderHover: string;
	import { goto } from '$app/navigation';
</script>

<button onclick={() => goto(href)} class={`bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 ${borderHover} transition group`}>
	<div class="flex items-center gap-4">
		<div class={`w-12 h-12 ${iconBg} rounded-full flex items-center justify-center group-hover:scale-110 transition`}>
			<svg class={`w-6 h-6 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={iconPath} />
			</svg>
		</div>
		<div class="text-left">
			<h3 class="font-semibold text-gray-900 dark:text-gray-100">{label}</h3>
			<p class="text-sm text-gray-500 dark:text-gray-400">{description}</p>
		</div>
	</div>
</button>
