<script lang="ts">
	import { Beaker, RotateCcw, FileText, Clock, Check, Pill } from '@lucide/svelte';
	
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
			? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200'
			: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200';
	$: statusBadge = muted
		? 'bg-gray-200 text-gray-800 dark:bg-slate-700 dark:text-white'
		: urgencyActive
			? urgencyBadge
			: isTaken
				? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-white'
				: isSnoozed
					? 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-white'
					: isOverdue
						? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-white'
						: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-white';

	$: timeBadgeClass = muted
		? 'bg-gray-400 text-black dark:bg-slate-600 dark:text-white'
		: urgencyActive
			? countdownStatus === 'critical'
				? 'bg-red-500 text-white'
				: 'bg-yellow-500 text-white'
			: 'bg-blue-600 text-white';

	$: missionBadgeClass = muted
		? 'bg-gray-200/70 text-black dark:bg-slate-700/70 dark:text-white'
		: urgencyActive
			? countdownStatus === 'critical'
				? 'bg-red-50 text-red-900 dark:bg-red-900/30 dark:text-white'
				: 'bg-yellow-50 text-yellow-900 dark:bg-yellow-900/30 dark:text-white'
			: 'bg-white/80 text-black dark:bg-slate-800/70 dark:text-white';

	$: baseGlow = isTaken
		? 'from-green-100/80 via-white to-green-200/40'
		: isSnoozed
			? 'from-yellow-100/80 via-white to-yellow-200/40'
			: isOverdue
				? 'from-red-100/80 via-white to-red-200/40'
				: 'from-blue-100/80 via-white to-indigo-200/40';

	$: urgencyGlow =
		isNextDose && !isTaken && countdownStatus === 'critical'
			? 'from-red-200/90 via-red-50 to-red-200/60'
			: isNextDose && !isTaken && countdownStatus === 'warning'
				? 'from-yellow-200/90 via-yellow-50 to-yellow-200/60'
				: null;

	$: cardGlow = muted
		? 'from-gray-100/90 via-gray-50 to-gray-200/70 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900'
		: urgencyGlow ?? baseGlow;

	$: baseRing = isTaken
		? 'ring-2 ring-green-200/70 dark:ring-green-700/40'
		: isOverdue
			? 'ring-2 ring-red-300/70 dark:ring-red-700/50 shadow-lg shadow-red-200/60 dark:shadow-red-900/20'
			: 'ring-1 ring-white/70 dark:ring-gray-700/60';

	$: cardRing = muted
		? 'ring-1 ring-gray-200/80 dark:ring-gray-700/70'
		: isNextDose && !isTaken && countdownStatus === 'critical'
			? 'ring-2 ring-red-400/80 shadow-lg shadow-red-200/80 dark:ring-red-600/70 dark:shadow-red-900/30'
			: isNextDose && !isTaken && countdownStatus === 'warning'
				? 'ring-2 ring-yellow-300/80 shadow-lg shadow-yellow-200/70 dark:ring-yellow-600/70 dark:shadow-yellow-900/30'
				: baseRing;

	$: baseRail = isTaken
		? 'bg-green-400'
		: isSnoozed
			? 'bg-yellow-400'
			: isOverdue
				? 'bg-red-400'
				: 'bg-blue-400';

	$: railColor = muted
		? 'bg-gray-400'
		: isNextDose && !isTaken && countdownStatus === 'critical'
			? 'bg-red-500'
			: isNextDose && !isTaken && countdownStatus === 'warning'
				? 'bg-yellow-500'
				: baseRail;

	$: iconBg = muted
		? 'bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-100'
		: isTaken
			? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-200'
			: isSnoozed
				? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-200'
				: isOverdue
					? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-200'
					: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-200';
</script>

<div
	class={`group relative overflow-hidden rounded-3xl border border-white/70 dark:border-slate-800/70 bg-gradient-to-br ${cardGlow} shadow-sm transition-all duration-200 ${cardRing}`}
>
	<div class={`absolute inset-y-0 left-0 w-1.5 ${railColor}`}></div>
	<div class={`absolute right-4 top-4 text-[11px] font-semibold tracking-wide uppercase px-3 py-1 rounded-full shadow-sm ${statusBadge}`}>
		{statusLabel}
	</div>
	<div class="relative p-4 md:p-5 pl-6 md:pl-7">
		<div class="flex flex-col lg:flex-row gap-4">
			<div class="flex items-start gap-3 flex-1 min-w-0">
				<div class={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconBg} shadow-inner`}>
					<Pill class="w-6 h-6" />
				</div>
				<div class="flex-1 min-w-0">
					<div class="flex flex-wrap items-center gap-2 text-xs font-semibold">
						<span class={`px-2.5 py-1 rounded-full ${missionBadgeClass} flex items-center gap-1`}>
						Misiune
					</span>
						<span class={`px-2.5 py-1 rounded-full ${missionBadgeClass}`}>Provocare zilnică</span>
						<span class={`ml-auto px-2.5 py-1 rounded-full shadow-sm ${timeBadgeClass} flex items-center gap-1`}>
						<Clock class="w-3 h-3" />
						{medication.time}
					</span>
					</div>
			<h4 class="mt-2 text-base md:text-lg font-semibold truncate drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)] text-black">
						{medication.medicationName}
					</h4>
					<div class="mt-3 space-y-2 text-xs md:text-sm">
			<div class="flex items-center gap-2 text-black">
			<Beaker class="w-6 h-6 text-black" />
			<span class="text-black">Doza</span>
				<span class="font-semibold text-black">{medication.quantity}</span>
					</div>
			<div class="flex items-center gap-2 text-black">
			<RotateCcw class="w-6 h-6 text-black" />
			<span class="text-black">Frecvență</span>
				<span class="font-semibold text-black">{medication.frequency}</span>
					</div>
					{#if medication.instructions}
				<div class="flex items-start gap-2 text-black">
					<FileText class="w-6 h-6 text-black" />
					<p class="text-black italic line-clamp-2">{medication.instructions}</p>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<div class="flex flex-col gap-2 w-full lg:w-auto">
				{#if isTaken}
					<span class="px-3 py-2 md:px-4 md:py-2 bg-green-500 text-white rounded-2xl text-xs md:text-sm font-semibold shadow-sm flex items-center justify-center gap-2 whitespace-nowrap">
						<Check class="w-4 h-4 flex-shrink-0" />
						Finalizat
					</span>
				{:else if isSnoozed}
				<div class="flex gap-2 w-full lg:w-auto">
					<span class="px-3 py-2 md:px-4 md:py-2 bg-yellow-100 text-yellow-900 rounded-2xl text-xs md:text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap dark:bg-yellow-900/40 dark:text-yellow-200">
						<Clock class="w-4 h-4 flex-shrink-0" />
						Amânat
					</span>
					<button onclick={() => onConfirm(medication)} class="flex-1 lg:flex-none px-3 py-2 md:px-4 md:py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 text-xs md:text-sm font-semibold shadow-sm transition touch-manipulation flex items-center justify-center gap-1">
						<Check class="w-4 h-4" />
						Confirmă
					</button>
					</div>
				{:else}
					<button onclick={() => onConfirm(medication)} class="flex-1 lg:flex-none px-3 py-2 md:px-4 md:py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 text-xs md:text-sm font-semibold shadow-sm transition touch-manipulation flex items-center justify-center gap-1">
						<Check class="w-4 h-4" />
						Confirmă
					</button>
					<button onclick={() => onSnooze(medication)} class="flex-1 lg:flex-none px-3 py-2 md:px-4 md:py-2 bg-white/90 dark:bg-slate-800 text-gray-700 dark:text-slate-100 rounded-2xl hover:bg-white dark:hover:bg-slate-700 active:bg-gray-50 dark:active:bg-slate-600 text-xs md:text-sm font-semibold transition touch-manipulation border border-white/70 dark:border-slate-700/80 flex items-center justify-center gap-1">
					<Clock class="w-4 h-4" />
					Amână +30min
				</button>
				{/if}
			</div>
		</div>
	</div>
</div>
