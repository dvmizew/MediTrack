<script lang="ts">
	export let medication: any;
	export let isTaken: boolean;
	export let isSnoozed: boolean;
	export let onConfirm: (med: any) => void;
	export let onSnooze: (med: any) => void;
	export let isNextDose: boolean = false;
	export let countdownStatus: 'none' | 'normal' | 'warning' | 'critical' | 'done' = 'none';
	export let muted: boolean = false;

	$: isOverdue = (() => {
		if (isTaken || isSnoozed || !medication?.time) return false;
		const [hours, minutes] = String(medication.time).split(':').map(Number);
		const scheduled = new Date();
		scheduled.setHours(hours || 0, minutes || 0, 0, 0);
		return scheduled.getTime() < Date.now();
	})();

	$: statusLabel = isTaken ? 'Completat' : isSnoozed ? 'Amânat' : isOverdue ? 'Întârziat' : 'În așteptare';
	$: urgencyActive =
		isNextDose && !isTaken && (countdownStatus === 'warning' || countdownStatus === 'critical');
	$: urgencyBadge =
		countdownStatus === 'critical'
			? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200'
			: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
	$: statusBadge = muted
		? 'bg-slate-200 text-slate-700 dark:bg-gray-800 dark:text-gray-200'
		: urgencyActive
			? urgencyBadge
			: isTaken
				? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
				: isSnoozed
					? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
					: isOverdue
						? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200'
						: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200';

	$: timeBadgeClass = muted
		? 'bg-slate-300 text-slate-700 dark:bg-gray-700 dark:text-gray-200'
		: urgencyActive
			? countdownStatus === 'critical'
				? 'bg-rose-500 text-white'
				: 'bg-amber-500 text-white'
			: 'bg-blue-600 text-white';

	$: missionBadgeClass = muted
		? 'bg-slate-200/70 text-slate-700 dark:bg-gray-800/70 dark:text-gray-200'
		: urgencyActive
			? countdownStatus === 'critical'
				? 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200'
				: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200'
			: 'bg-white/80 text-slate-700 dark:bg-slate-800/70 dark:text-slate-100';

	$: baseGlow = isTaken
		? 'from-emerald-100/80 via-white to-emerald-200/40'
		: isSnoozed
			? 'from-amber-100/80 via-white to-amber-200/40'
			: isOverdue
				? 'from-rose-100/80 via-white to-rose-200/40'
				: 'from-blue-100/80 via-white to-indigo-200/40';

	$: urgencyGlow =
		isNextDose && !isTaken && countdownStatus === 'critical'
			? 'from-rose-200/90 via-rose-50 to-rose-200/60'
			: isNextDose && !isTaken && countdownStatus === 'warning'
				? 'from-amber-200/90 via-amber-50 to-amber-200/60'
				: null;

	$: cardGlow = muted
		? 'from-slate-100/90 via-slate-50 to-slate-200/70 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900'
		: urgencyGlow ?? baseGlow;

	$: baseRing = isTaken
		? 'ring-2 ring-emerald-200/70 dark:ring-emerald-700/40'
		: isOverdue
			? 'ring-2 ring-rose-300/70 dark:ring-rose-700/50 shadow-lg shadow-rose-200/60 dark:shadow-rose-900/20'
			: 'ring-1 ring-white/70 dark:ring-gray-700/60';

	$: cardRing = muted
		? 'ring-1 ring-slate-200/80 dark:ring-gray-700/70'
		: isNextDose && !isTaken && countdownStatus === 'critical'
			? 'ring-2 ring-rose-400/80 shadow-lg shadow-rose-200/80 dark:ring-rose-600/70 dark:shadow-rose-900/30'
			: isNextDose && !isTaken && countdownStatus === 'warning'
				? 'ring-2 ring-amber-300/80 shadow-lg shadow-amber-200/70 dark:ring-amber-600/70 dark:shadow-amber-900/30'
				: baseRing;

	$: baseRail = isTaken
		? 'bg-emerald-400'
		: isSnoozed
			? 'bg-amber-400'
			: isOverdue
				? 'bg-rose-400'
				: 'bg-blue-400';

	$: railColor = muted
		? 'bg-slate-400'
		: isNextDose && !isTaken && countdownStatus === 'critical'
			? 'bg-rose-500'
			: isNextDose && !isTaken && countdownStatus === 'warning'
				? 'bg-amber-500'
				: baseRail;

	$: iconBg = muted
		? 'bg-slate-200 text-slate-600 dark:bg-gray-800 dark:text-gray-200'
		: isTaken
			? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-200'
			: isSnoozed
				? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-200'
				: isOverdue
					? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-200'
					: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-200';
</script>

<div
	class={`group relative overflow-hidden rounded-3xl border border-white/70 dark:border-gray-800/70 bg-gradient-to-br ${cardGlow} shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${cardRing} ${
		muted ? 'grayscale saturate-0 opacity-90' : ''
	}`}
>
	<div class={`absolute inset-y-0 left-0 w-1.5 ${railColor}`}></div>
	<div class={`absolute right-4 top-4 text-[11px] font-semibold tracking-wide uppercase px-3 py-1 rounded-full shadow-sm ${statusBadge}`}>
		{statusLabel}
	</div>
	<div class="relative p-4 md:p-5 pl-6 md:pl-7">
		<div class="flex flex-col lg:flex-row gap-4">
			<div class="flex items-start gap-3 flex-1 min-w-0">
				<div class={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconBg} shadow-inner`}>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-2.21 0-4 1.79-4 4 0 1.1.45 2.1 1.17 2.83L12 20l2.83-5.17A4 4 0 0016 12c0-2.21-1.79-4-4-4z"/>
					</svg>
				</div>
				<div class="flex-1 min-w-0">
					<div class="flex flex-wrap items-center gap-2 text-xs font-semibold">
						<span class={`px-2.5 py-1 rounded-full ${missionBadgeClass}`}>🎮 Misiune</span>
						<span class={`px-2.5 py-1 rounded-full ${missionBadgeClass}`}>Provocare zilnică</span>
						<span class={`ml-auto px-2.5 py-1 rounded-full shadow-sm ${timeBadgeClass}`}>🕒 {medication.time}</span>
					</div>
					<h4 class="mt-2 text-base md:text-lg font-semibold text-slate-900 dark:text-white truncate drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]">
						{medication.medicationName}
					</h4>
					<div class="mt-3 space-y-2 text-xs md:text-sm">
						<div class="flex items-center gap-2 text-slate-700 dark:text-slate-200">
							<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/80 text-slate-600 dark:bg-slate-800/70 dark:text-slate-100">🧪</span>
							<span class="text-slate-600 dark:text-slate-300">Doza</span>
							<span class="font-semibold text-slate-900 dark:text-slate-100">{medication.quantity}</span>
						</div>
						<div class="flex items-center gap-2 text-slate-700 dark:text-slate-200">
							<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/80 text-slate-600 dark:bg-slate-800/70 dark:text-slate-100">🔁</span>
							<span class="text-slate-600 dark:text-slate-300">Frecvență</span>
							<span class="font-semibold text-slate-900 dark:text-slate-100">{medication.frequency}</span>
						</div>
						{#if medication.instructions}
							<div class="flex items-start gap-2 text-slate-700 dark:text-slate-200">
								<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/80 text-slate-600 dark:bg-slate-800/70 dark:text-slate-100">📝</span>
								<p class="text-slate-600 dark:text-slate-300 italic line-clamp-2">{medication.instructions}</p>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<div class="flex flex-row lg:flex-col gap-2 w-full lg:w-auto">
				{#if isTaken}
					<span class="px-3 py-2 md:px-4 md:py-2 bg-emerald-500 text-white rounded-2xl text-xs md:text-sm font-semibold shadow-sm flex items-center justify-center gap-2 whitespace-nowrap">
						<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
						</svg>
						Finalizat
					</span>
				{:else if isSnoozed}
					<div class="flex items-center gap-2 w-full lg:w-auto">
						<span class="px-3 py-2 md:px-4 md:py-2 bg-amber-100 text-amber-800 rounded-2xl text-xs md:text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap dark:bg-amber-900/40 dark:text-amber-200">
							<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
							</svg>
							Amânat
						</span>
						<button onclick={() => onConfirm(medication)} class="flex-1 lg:flex-none px-3 py-2 md:px-4 md:py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 text-xs md:text-sm font-semibold shadow-sm transition touch-manipulation">✓ Confirmă</button>
					</div>
				{:else}
					<button onclick={() => onConfirm(medication)} class="flex-1 lg:flex-none px-3 py-2 md:px-4 md:py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 text-xs md:text-sm font-semibold shadow-sm transition touch-manipulation">✓ Confirmă</button>
					<button onclick={() => onSnooze(medication)} class="flex-1 lg:flex-none px-3 py-2 md:px-4 md:py-2 bg-white/90 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-2xl hover:bg-white dark:hover:bg-gray-700 active:bg-gray-50 dark:active:bg-gray-600 text-xs md:text-sm font-semibold transition touch-manipulation border border-white/70 dark:border-gray-700/80">⏰ Amână +30min</button>
				{/if}
			</div>
		</div>
	</div>
</div>
