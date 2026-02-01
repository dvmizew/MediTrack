<script lang="ts">
	import { onDestroy } from 'svelte';
	import { authStore } from '$lib/stores/auth';
	import MedicationItem from '$lib/components/MedicationItem.svelte';
	import StreakCircle from '$lib/components/StreakCircle.svelte';

	export let loading: boolean = false;
	export let medications: Array<any> = [];
	export let isTakenFn: (m: any) => boolean;
	export let isSnoozedFn: (m: any) => boolean;
	export let onConfirm: (m: any) => void;
	export let onSnooze: (m: any) => void;
	export let countdownText: string = '--:--:--';
	export let countdownProgress: number = 0;
	export let countdownStatus: 'none' | 'normal' | 'warning' | 'critical' | 'done' = 'none';
	export let nextDoseId: number | null = null;
	export let streak: number = $authStore.user?.currentStreak || 0;
	export let muted: boolean = false;
	export let celebrate: boolean = false;

	const normalizeId = (value: unknown) => (value === null || value === undefined ? null : String(value));

	const confettiPalette = ['#6366f1', '#22c55e', '#f97316', '#e11d48', '#38bdf8', '#facc15'];
	const confettiCount = 120;
	const confettiDurationMs = 3500;

	let confettiActive = false;
	let confettiKey = 0;
	let confettiPieces: Array<{
		id: number;
		x: number;
		y: number;
		size: number;
		rot: number;
		delay: number;
		duration: number;
		color: string;
	}> = [];
	let lastCelebrate = celebrate;
	let confettiTimer: ReturnType<typeof setTimeout> | null = null;

	function buildConfettiPieces() {
		return Array.from({ length: confettiCount }, (_, index) => ({
			id: index,
			x: Math.round(Math.random() * 1100 - 760),
			y: Math.round(520 + Math.random() * 360),
			size: Math.round(12 + Math.random() * 12),
			rot: Math.round(Math.random() * 360),
			delay: Math.random() * 0.2,
			duration: 3 + Math.random() * 2,
			color: confettiPalette[Math.floor(Math.random() * confettiPalette.length)]
		}));
	}

	function triggerConfetti() {
		confettiPieces = buildConfettiPieces();
		confettiKey = Date.now();
		confettiActive = true;
		if (confettiTimer) {
			clearTimeout(confettiTimer);
		}
		confettiTimer = setTimeout(() => {
			confettiActive = false;
		}, confettiDurationMs);
	}

	$: if (celebrate !== lastCelebrate) {
		if (celebrate) {
			triggerConfetti();
		}
		lastCelebrate = celebrate;
	}

	onDestroy(() => {
		if (confettiTimer) {
			clearTimeout(confettiTimer);
		}
	});
</script>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
	<!-- Medications Card (2 columns on large screens) -->
	<div
		class={`lg:col-span-2 rounded-2xl shadow-sm border overflow-hidden backdrop-blur ${
			muted
				? 'bg-slate-100/80 dark:bg-gray-900/70 border-slate-200/70 dark:border-gray-800/80'
				: 'bg-white/90 dark:bg-gray-900/80 border-white/70 dark:border-gray-800/70'
		}`}
	>
		<div
			class={`p-4 md:p-6 border-b ${
				muted
					? 'border-slate-200/70 dark:border-gray-800/80 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900'
					: 'border-white/70 dark:border-gray-800/70 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900'
			}`}
		>
			<div class="flex items-center gap-3">
				<span
					class={`inline-flex items-center justify-center w-10 h-10 rounded-2xl text-white shadow-sm ${
						muted ? 'bg-slate-500' : 'bg-indigo-600'
					}`}
				>
					🏆
				</span>
				<div>
					<h3 class="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">Challenges</h3>
					<p class="text-xs md:text-sm text-gray-800 dark:text-gray-300 font-medium">Medicamentele de astăzi</p>
				</div>
			</div>
		</div>

		{#if loading}
			<div class="flex justify-center py-8 md:py-12">
				<div class="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent shadow-lg shadow-blue-500/50 animate-pulse"></div>
			</div>
		{:else if medications.length === 0}
			<div class="p-8 md:p-12 text-center">
				<svg class="w-12 h-12 md:w-16 md:h-16 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
				</svg>
				<p class="text-sm md:text-base text-gray-500 dark:text-gray-400">Nu ai medicamente programate astăzi</p>
			</div>
		{:else}
			<div
				class={`space-y-4 p-4 md:p-5 ${
					muted
						? 'bg-gradient-to-b from-slate-100/80 to-slate-200/70 dark:from-gray-900 dark:to-gray-900'
						: 'bg-gradient-to-b from-white/70 to-slate-100/80 dark:from-gray-900 dark:to-gray-900'
				}`}
			>
				{#each medications as medication}
					<MedicationItem
						medication={medication}
						isTaken={isTakenFn(medication)}
						isSnoozed={isSnoozedFn(medication)}
						isNextDose={
							!!nextDoseId &&
							normalizeId(medication.doseId ?? medication.id ?? medication.medicationId) ===
								normalizeId(nextDoseId)
						}
						countdownStatus={countdownStatus}
						onConfirm={onConfirm}
						onSnooze={onSnooze}
						muted={muted}
					/>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Streak Widget (1 column on large screens) - Just the sphere at TOP -->
	<div class="flex flex-col items-center justify-start pt-0 relative">
		{#if confettiActive}
			<div class="confetti-layer" aria-hidden="true">
				{#key confettiKey}
					{#each confettiPieces as piece (piece.id)}
						<span
							class="confetti-piece"
							style={`--confetti-x: ${piece.x}px; --confetti-y: ${piece.y}px; --confetti-rot: ${piece.rot}deg; --confetti-size: ${piece.size}px; --confetti-delay: ${piece.delay}s; --confetti-duration: ${piece.duration}s; --confetti-color: ${piece.color};`}
						></span>
					{/each}
				{/key}
			</div>
		{/if}
		<StreakCircle
			streak={streak}
			countdownText={countdownText}
			progress={countdownProgress}
			status={countdownStatus}
			muted={muted}
		/>
		<p
			class={`text-sm mt-4 text-center font-medium ${
				muted ? 'text-slate-600 dark:text-slate-300' : 'text-gray-700 dark:text-gray-300'
			}`}
		>
			Zile consecutive
		</p>
	</div>
</div>

<style>
	.confetti-layer {
		position: absolute;
		top: -80px;
		left: 50%;
		width: 1px;
		height: 1px;
		pointer-events: none;
		z-index: 10;
		overflow: visible;
	}

	.confetti-piece {
		position: absolute;
		width: var(--confetti-size);
		height: calc(var(--confetti-size) * 0.6);
		background: var(--confetti-color);
		border-radius: 999px;
		transform: translate(-50%, 0) rotate(var(--confetti-rot));
		animation: confetti-burst var(--confetti-duration) ease-out var(--confetti-delay) forwards;
	}

	@keyframes confetti-burst {
		0% {
			transform: translate(-50%, 0) rotate(0deg);
			opacity: 1;
		}
		70% {
			opacity: 1;
		}
		100% {
			transform: translate(calc(-50% + var(--confetti-x)), var(--confetti-y)) rotate(var(--confetti-rot));
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.confetti-piece {
			animation: none;
			opacity: 0;
		}
	}
</style>
