<script lang="ts">
	export let name: string;
	export let subtitle: string;
	export let showIcon: boolean = true;
</script>

<div class="bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl p-4 md:p-6 text-white shadow-lg">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-xl md:text-2xl font-bold mb-1">Bine ai revenit, {name}!</h2>
			<p class="text-blue-100 text-sm md:text-base">{subtitle}</p>
		</div>
		{#if showIcon}
			<div class="hidden sm:block">
				<svg class="w-16 h-16 text-white/20" fill="currentColor" viewBox="0 0 24 24">
					<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/>
				</svg>
			</div>
		{/if}
	</div>
</div>
