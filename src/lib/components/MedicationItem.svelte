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
		const timeStr = String(medication.time || '0:0');
		const parts = timeStr.split(':');
		const [hours, minutes] = parts.map(Number);
		if (isNaN(hours) || isNaN(minutes)) return false;
		const scheduled = new Date();
		scheduled.setHours(hours || 0, minutes || 0, 0, 0);
		return scheduled.getTime() < Date.now();
	})();

	$: statusLabel = isTaken
		? 'Completat'
		: isSnoozed
			? 'Amânat'
			: isOverdue
				? 'Întârziat'
				: 'În așteptare';
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
		: (urgencyGlow ?? baseGlow);

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
	class={`group relative overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-br dark:border-slate-800/70 ${cardGlow} shadow-sm transition-all duration-200 ${cardRing}`}
>
	<div class={`absolute inset-y-0 left-0 w-1.5 ${railColor}`}></div>
	<div
		class={`absolute top-4 right-4 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase shadow-sm ${statusBadge}`}
	>
		{statusLabel}
	</div>
	<div class="relative p-4 pl-6 md:p-5 md:pl-7">
		<div class="flex flex-col gap-4 lg:flex-row">
			<div class="flex min-w-0 flex-1 items-start gap-3">
				<div
					class={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconBg} shadow-inner`}
				>
					<Pill class="h-6 w-6" />
				</div>
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-2 text-xs font-semibold">
						<span class={`rounded-full px-2.5 py-1 ${missionBadgeClass} flex items-center gap-1`}>
							Misiune
						</span>
						<span class={`rounded-full px-2.5 py-1 ${missionBadgeClass}`}>Provocare zilnică</span>
						<span
							class={`ml-auto rounded-full px-2.5 py-1 shadow-sm ${timeBadgeClass} flex items-center gap-1`}
						>
							<Clock class="h-3 w-3" />
							{medication.time}
						</span>
					</div>
					<h4
						class={`mt-2 truncate text-base font-semibold drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)] md:text-lg ${muted ? 'text-white' : 'text-black'}`}
					>
						{medication.medicationName}
					</h4>
					<div class="mt-3 space-y-2 text-xs md:text-sm">
						<div class={`flex items-center gap-2 ${muted ? 'text-white' : 'text-black'}`}>
							<Beaker class={`h-6 w-6 ${muted ? 'text-white' : 'text-black'}`} />
							<span class={muted ? 'text-white' : 'text-black'}>Doza</span>
							<span class={`font-semibold ${muted ? 'text-white' : 'text-black'}`}
								>{medication.quantity}</span
							>
						</div>
						<div class={`flex items-center gap-2 ${muted ? 'text-white' : 'text-black'}`}>
							<RotateCcw class={`h-6 w-6 ${muted ? 'text-white' : 'text-black'}`} />
							<span class={muted ? 'text-white' : 'text-black'}>Frecvență</span>
							<span class={`font-semibold ${muted ? 'text-white' : 'text-black'}`}
								>{medication.frequency}</span
							>
						</div>
						{#if medication.instructions}
							<div class={`flex items-start gap-2 ${muted ? 'text-white' : 'text-black'}`}>
								<FileText class={`h-6 w-6 ${muted ? 'text-white' : 'text-black'}`} />
								<p class={`line-clamp-2 italic ${muted ? 'text-white' : 'text-black'}`}>
									{medication.instructions}
								</p>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<div class="flex w-full flex-col gap-2 lg:w-auto">
				{#if isTaken}
					<span
						class="flex items-center justify-center gap-2 rounded-2xl bg-green-500 px-3 py-2 text-xs font-semibold whitespace-nowrap text-white shadow-sm md:px-4 md:py-2 md:text-sm"
					>
						<Check class="h-4 w-4 flex-shrink-0" />
						Finalizat
					</span>
				{:else if isSnoozed}
					<div class="flex w-full gap-2 lg:w-auto">
						<span
							class="flex items-center justify-center gap-2 rounded-2xl bg-yellow-100 px-3 py-2 text-xs font-semibold whitespace-nowrap text-yellow-900 md:px-4 md:py-2 md:text-sm dark:bg-yellow-900/40 dark:text-yellow-200"
						>
							<Clock class="h-4 w-4 flex-shrink-0" />
							Amânat
						</span>
						<button
							onclick={() => onConfirm(medication)}
							class="flex flex-1 touch-manipulation items-center justify-center gap-1 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 md:px-4 md:py-2 md:text-sm lg:flex-none"
						>
							<Check class="h-4 w-4" />
							Confirmă
						</button>
					</div>
				{:else}
					<button
						onclick={() => onConfirm(medication)}
						class="flex flex-1 touch-manipulation items-center justify-center gap-1 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 md:px-4 md:py-2 md:text-sm lg:flex-none"
					>
						<Check class="h-4 w-4" />
						Confirmă
					</button>
					<button
						onclick={() => onSnooze(medication)}
						class="flex flex-1 touch-manipulation items-center justify-center gap-1 rounded-2xl border border-white/70 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-white active:bg-gray-50 md:px-4 md:py-2 md:text-sm lg:flex-none dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:active:bg-slate-600"
					>
						<Clock class="h-4 w-4" />
						Amână +30min
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>
