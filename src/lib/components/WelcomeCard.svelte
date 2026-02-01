<script lang="ts">
	export let name: string;
	export let subtitle: string;
	export let showIcon: boolean = true;
	export let title: string | null = null;
	export let tone: 'default' | 'celebrate' | 'warning' | 'critical' | 'sad' = 'default';

	$: cardGradient =
		tone === 'celebrate'
			? 'from-emerald-500 via-teal-500 to-cyan-500'
			: tone === 'warning'
				? 'from-amber-500 via-yellow-500 to-orange-500'
				: tone === 'critical'
					? 'from-rose-500 via-red-500 to-orange-500'
					: tone === 'sad'
						? 'from-slate-600 via-slate-700 to-slate-900'
						: 'from-blue-600 to-purple-600';

	$: subtitleClass =
		tone === 'celebrate'
			? 'text-emerald-50'
			: tone === 'warning'
				? 'text-amber-50'
				: tone === 'critical'
					? 'text-rose-50'
					: tone === 'sad'
						? 'text-slate-100'
						: 'text-blue-100';

	$: titleText = title ?? `Bine ai revenit, ${name}!`;
</script>

<div class={`bg-gradient-to-br ${cardGradient} rounded-xl p-4 md:p-6 text-white shadow-lg`}>
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-xl md:text-2xl font-bold mb-1">{titleText}</h2>
			<p class={`${subtitleClass} text-base md:text-xl`}>{subtitle}</p>
		</div>
		{#if showIcon}
			<div class="hidden sm:block">
				{#if tone === 'celebrate'}
					<div class="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-3xl">🎉</div>
				{:else if tone === 'warning'}
					<div class="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-3xl">⏳</div>
				{:else if tone === 'critical'}
					<div class="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-3xl animate-alarm">🚨</div>
				{:else if tone === 'sad'}
					<div class="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center text-3xl">😔</div>
				{:else}
					<svg class="w-16 h-16 text-white/20" fill="currentColor" viewBox="0 0 24 24">
						<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/>
					</svg>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.animate-alarm {
		animation: alarm 0.9s ease-in-out infinite;
	}

	@keyframes alarm {
		0% {
			transform: translateY(0) rotate(0deg) scale(1);
		}
		20% {
			transform: translateY(-6px) rotate(-6deg) scale(1.04);
		}
		40% {
			transform: translateY(0) rotate(6deg) scale(1.05);
		}
		60% {
			transform: translateY(-5px) rotate(-4deg) scale(1.03);
		}
		80% {
			transform: translateY(0) rotate(4deg) scale(1.02);
		}
		100% {
			transform: translateY(0) rotate(0deg) scale(1);
		}
	}
</style>
