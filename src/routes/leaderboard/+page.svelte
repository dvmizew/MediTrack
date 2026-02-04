<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore, isPacient } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import type { LeaderboardEntry } from '$lib/types/api';
	import Card from '$lib/components/Card.svelte';
	import {
		Calendar,
		CalendarDays,
		ChevronDown,
		Flame,
		Gem,
		LoaderCircle,
		Medal,
		RefreshCw,
		Sparkles,
		Star,
		Target,
		Trophy
	} from '@lucide/svelte';

	let loading = $state(true);
	let leaderboard = $state<LeaderboardEntry[]>([]);
	let timeFilter = $state<'all' | 'month' | 'week'>('all');
	let currentUserPosition = $state(0);
	let expandedUserId = $state<number | null>(null);
	let refreshing = $state(false);

	onMount(async () => {
		// Wait a bit for auth to be loaded from localStorage
		if (!$authStore.user) {
			// Try loading auth from localStorage/cookies
			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		if ($authStore.user) {
			await loadLeaderboard();
		} else {
			console.warn('User not authenticated');
		}
		loading = false;
	});

	async function loadLeaderboard() {
		try {
			refreshing = !loading;
			loading = true;
			const data = await api.getLeaderboard(timeFilter);
			leaderboard = data;

			// Find current user rank
			const user = $authStore.user;
			if (user && $isPacient) {
				currentUserPosition = leaderboard.findIndex(
					(u) => u.userId === user.id || u.id === user.id
				);
			} else {
				currentUserPosition = -1;
			}
		} catch (error) {
			console.error('Failed to load leaderboard:', error);
		} finally {
			loading = false;
			refreshing = false;
		}
	}

	function changeFilter(newFilter: 'all' | 'month' | 'week') {
		timeFilter = newFilter;
		loadLeaderboard();
	}

	function toggleUserDetails(userId: number) {
		expandedUserId = expandedUserId === userId ? null : userId;
	}

	function getBadgeIconComponent(badge: string | null) {
		const badges: Record<string, any> = {
			bronze: Medal,
			silver: Medal,
			gold: Medal,
			platinum: Gem,
			diamond: Star
		};
		return badges[badge || 'bronze'] || Medal;
	}

	function getBadgeColor(badge: string | null) {
		const colors: Record<string, string> = {
			bronze:
				'bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700',
			silver:
				'bg-slate-100 dark:bg-slate-900/30 text-slate-900 dark:text-slate-300 border-slate-300 dark:border-slate-700',
			gold: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
			platinum:
				'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300 border-blue-300 dark:border-blue-700',
			diamond:
				'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-700'
		};
		return (
			colors[badge || 'bronze'] ||
			'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-slate-100 border-gray-300 dark:border-slate-700'
		);
	}

	function getRankMedalIcon(position: number) {
		if (position === 0) return Trophy;
		if (position === 1) return Medal;
		if (position === 2) return Medal;
		return null;
	}

	function getProgressToNextBadge(xp: number, badge: string | null) {
		const thresholds = {
			bronze: { next: 'silver', xp: 500 },
			silver: { next: 'gold', xp: 1500 },
			gold: { next: 'platinum', xp: 3000 },
			platinum: { next: 'diamond', xp: 5000 },
			diamond: { next: null, xp: 0 }
		};

		const current = thresholds[badge as keyof typeof thresholds] || thresholds.bronze;
		if (!current.next) return null;

		const progress = (xp / current.xp) * 100;
		return { progress: Math.min(progress, 100), next: current.next, target: current.xp };
	}

	const badgeShowcase = [
		{ key: 'bronze', label: 'Bronze', xp: '0 XP', hint: 'Start' },
		{ key: 'silver', label: 'Silver', xp: '500 XP', hint: 'Primul prag' },
		{ key: 'gold', label: 'Gold', xp: '1500 XP', hint: 'Progres stabil' },
		{ key: 'platinum', label: 'Platinum', xp: '3000 XP', hint: 'Nivel avansat' },
		{ key: 'diamond', label: 'Diamond', xp: '5000+ XP', hint: 'Maxim' }
	];
</script>

<div class="page-transition min-h-screen bg-transparent p-4 sm:p-6">
	<div class="mx-auto max-w-6xl">
		<!-- Header -->
		<div class="mb-8 text-center">
			<div
				class="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg"
			>
				<Trophy class="h-10 w-10 text-white" />
			</div>
			<h1
				class="mb-2 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl md:text-6xl"
			>
				Leaderboard
			</h1>
			<p class="text-sm font-medium text-gray-900 sm:text-base dark:text-slate-100">
				Clasament pacienți, progres individual și realizări colective
			</p>
		</div>

		<!-- Filter Buttons -->
		<div class="mb-4 flex flex-wrap justify-center gap-3">
			<button
				onclick={() => changeFilter('all')}
				class={`transform rounded-xl px-6 py-3 font-semibold transition-all duration-300 ${
					timeFilter === 'all'
						? 'scale-105 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl ring-4 ring-blue-200 dark:ring-blue-900'
						: 'border-2 border-slate-200 bg-white/95 text-gray-900 backdrop-blur-sm hover:scale-105 hover:border-blue-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100'
				}`}
			>
				<span class="inline-flex items-center gap-2">
					<Sparkles class="h-4 w-4" />
					All time
				</span>
			</button>
			<button
				onclick={() => changeFilter('week')}
				class={`transform rounded-xl px-6 py-3 font-semibold transition-all duration-300 ${
					timeFilter === 'week'
						? 'scale-105 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl ring-4 ring-blue-200 dark:ring-blue-900'
						: 'border-2 border-slate-200 bg-white/95 text-gray-900 backdrop-blur-sm hover:scale-105 hover:border-blue-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100'
				}`}
			>
				<span class="inline-flex items-center gap-2">
					<CalendarDays class="h-4 w-4" />
					Săptămâna
				</span>
			</button>
			<button
				onclick={() => changeFilter('month')}
				class={`transform rounded-xl px-6 py-3 font-semibold transition-all duration-300 ${
					timeFilter === 'month'
						? 'scale-105 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl ring-4 ring-blue-200 dark:ring-blue-900'
						: 'border-2 border-slate-200 bg-white/95 text-gray-900 backdrop-blur-sm hover:scale-105 hover:border-blue-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100'
				}`}
			>
				<span class="inline-flex items-center gap-2">
					<Calendar class="h-4 w-4" />
					Lună
				</span>
			</button>
		</div>

		<!-- Refresh Button -->
		<div class="mb-8 flex justify-center">
			<button
				onclick={() => loadLeaderboard()}
				disabled={refreshing}
				class="transform rounded-xl border-2 border-slate-200 bg-white/95 px-6 py-3 font-semibold text-gray-900 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-green-300 hover:shadow-lg disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
			>
				{#if refreshing}
					<RefreshCw class="h-4 w-4 animate-spin" />
				{:else}
					<span class="inline-flex items-center gap-2">
						<RefreshCw class="h-4 w-4" />
						Refresh
					</span>
				{/if}
			</button>
		</div>

		<!-- Current User Position (if patient) -->
		{#if $isPacient && currentUserPosition >= 0}
			<div
				class="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 text-white shadow-2xl transition-all duration-300"
			>
				<div class="absolute top-0 right-0 -mt-32 -mr-32 h-64 w-64 rounded-full bg-white/10"></div>
				<div
					class="absolute bottom-0 left-0 -mb-24 -ml-24 h-48 w-48 rounded-full bg-white/10"
				></div>
				<div class="relative flex items-center justify-between">
					<div>
						<p class="mb-1 inline-flex items-center gap-2 text-sm font-medium opacity-90">
							<Target class="h-4 w-4" />
							Poziția ta în clasament
						</p>
						<p class="mt-2 text-5xl font-black drop-shadow-lg sm:text-6xl">
							#{currentUserPosition + 1}
						</p>
						{#if leaderboard[currentUserPosition]}
							<div class="mt-4 flex items-center gap-4">
								<div
									class="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur"
								>
									<Star class="h-4 w-4" />
									<span class="font-bold">{leaderboard[currentUserPosition].xp} XP</span>
								</div>
								<div
									class="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur"
								>
									<Flame class="h-4 w-4" />
									<span class="font-bold">{leaderboard[currentUserPosition].streak} streak</span>
								</div>
							</div>
						{/if}
					</div>
					<div class="animate-pulse text-7xl drop-shadow-2xl sm:text-8xl">
						{#snippet medalIcon()}
							{@const Icon = getRankMedalIcon(currentUserPosition)}
							{#if Icon}
								<Icon class="h-16 w-16 text-white sm:h-20 sm:w-20" />
							{:else}
								<div
									class="flex h-16 w-16 items-center justify-center text-4xl font-black text-white sm:h-20 sm:w-20 sm:text-5xl"
								>
									#{currentUserPosition + 1}
								</div>
							{/if}
						{/snippet}
						{@render medalIcon()}
					</div>
				</div>
			</div>
		{/if}

		<!-- Badge thresholds overview -->
		<div
			class="mb-8 rounded-2xl border-2 border-purple-200 bg-gradient-to-r from-purple-50 via-blue-50 to-indigo-50 p-8 shadow-lg dark:border-purple-800 dark:from-purple-950 dark:via-blue-950 dark:to-indigo-950"
		>
			<div class="mb-6 flex flex-col gap-2">
				<div class="flex items-center gap-2">
					<Sparkles class="h-6 w-6 text-purple-600 dark:text-purple-400" />
					<h2 class="text-2xl font-black text-purple-900 dark:text-purple-100">
						Badge-uri & praguri XP
					</h2>
				</div>
				<p class="text-sm text-purple-800 dark:text-purple-200">
					Acesta este ghidul de niveluri: fiecare badge se deblochează la un prag de XP.
				</p>
			</div>
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
				{#each badgeShowcase as badge}
					{@const badgeIcon = getBadgeIconComponent(badge.key)}
					{@const badgeColor = getBadgeColor(badge.key)}
					{@const Icon = badgeIcon}
					<div
						class="rounded-xl border-2 border-transparent bg-white/70 p-4 text-center backdrop-blur transition-transform duration-300 hover:scale-105 hover:border-purple-400 dark:bg-slate-800/70"
					>
						<div class="mb-2 flex justify-center">
							<div class={`rounded-full p-3 ${badgeColor}`}>
								<Icon class="h-6 w-6 text-white" />
							</div>
						</div>
						<p class="text-sm font-bold text-gray-900 dark:text-slate-100">{badge.label}</p>
						<p class="mt-1 text-xs text-gray-600 dark:text-slate-300">{badge.xp}</p>
						<p class="mt-1 text-[11px] text-gray-500 dark:text-slate-400">{badge.hint}</p>
					</div>
				{/each}
			</div>
		</div>

		<!-- Leaderboard Cards -->
		<div class="mb-8 space-y-4">
			{#if loading && !refreshing}
				<Card
					renderCustom
					unstyled
					containerClass="p-12 text-center bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-2xl shadow-lg"
				>
					<div class="inline-block animate-spin">
						<LoaderCircle class="h-16 w-16 text-blue-600" />
					</div>
					<p class="mt-4 font-medium text-gray-900 dark:text-slate-100">
						Se încarcă leaderboard-ul...
					</p>
				</Card>
			{:else if leaderboard.length === 0}
				<Card
					renderCustom
					unstyled
					containerClass="p-12 text-center bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-2xl shadow-lg"
				>
					<Trophy class="mx-auto mb-4 h-14 w-14 text-yellow-500" />
					<p class="text-xl font-medium text-gray-900 dark:text-slate-100">
						Nu au fost găsiți pacienți pe leaderboard
					</p>
				</Card>
			{:else}
				{#each leaderboard as user, index (user.userId)}
					{@const isCurrentUser = $authStore.user?.id === user.userId}
					{@const isTop3 = index < 3}
					{@const BadgeIcon = getBadgeIconComponent(user.badge)}
					{@const progress = getProgressToNextBadge(user.xp ?? user.totalXp, user.badge)}

					<button
						onclick={() => toggleUserDetails(user.userId)}
						class={`w-full transform text-left transition-all duration-300 hover:scale-102 ${
							isTop3
								? index === 0
									? 'bg-gradient-to-r from-yellow-50 via-amber-50 to-orange-50 ring-4 ring-yellow-300 dark:from-yellow-950 dark:via-amber-950 dark:to-orange-950 dark:ring-yellow-700/50'
									: index === 1
										? 'bg-gradient-to-r from-slate-50 via-gray-50 to-zinc-50 ring-4 ring-slate-300 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:ring-slate-700/50'
										: 'bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 ring-4 ring-orange-300 dark:from-orange-950 dark:via-amber-950 dark:to-yellow-950 dark:ring-orange-700/50'
								: isCurrentUser
									? 'bg-gradient-to-r from-blue-50 to-indigo-50 ring-2 ring-blue-400 dark:from-blue-950 dark:to-indigo-950 dark:ring-blue-600/50'
									: 'border border-slate-200 bg-white/95 backdrop-blur-sm hover:shadow-xl dark:border-slate-700/50 dark:bg-slate-900/95 dark:shadow-lg'
						} rounded-2xl p-6 shadow-lg`}
					>
						<div class="flex items-center justify-between gap-4">
							<div class="flex min-w-0 flex-1 items-center gap-4">
								<!-- Rank Badge -->
								<div
									class={`flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full text-2xl font-black ${
										isTop3
											? 'animate-pulse bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg'
											: 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-200'
									}`}
								>
									{#if index < 3}
										{@const Icon = getRankMedalIcon(index)}
										<Icon class="h-7 w-7 text-white" />
									{:else}
										#{index + 1}
									{/if}
								</div>

								<div class="relative flex-shrink-0">
									<div
										class={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white shadow-lg ${
											isTop3
												? 'bg-gradient-to-br from-purple-500 to-pink-500 ring-4 ring-purple-200 dark:ring-purple-800'
												: 'bg-gradient-to-br from-blue-500 to-purple-600'
										}`}
									>
										{user.name?.charAt(0).toUpperCase() || 'U'}
									</div>
									{#if isTop3}
										<div
											class="absolute -top-1 -right-1 flex h-6 w-6 animate-bounce items-center justify-center rounded-full bg-yellow-400 text-xs"
										>
											<Star class="h-3.5 w-3.5 text-white" />
										</div>
									{/if}
								</div>

								<!-- Name + Badge -->
								<div class="min-w-0 flex-1">
									<div class="mb-1 flex items-center gap-2">
										<p class="truncate text-lg font-bold text-gray-900 dark:text-slate-100">
											{user.name || 'User'}
										</p>
										{#if isCurrentUser}
											<span
												class="rounded-full bg-blue-500 px-2 py-0.5 text-xs font-bold text-white"
												>TU</span
											>
										{/if}
									</div>
									<span
										class={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-bold ${getBadgeColor(user.badge)}`}
									>
										<BadgeIcon class="h-4 w-4" />
										<span class="capitalize">{user.badge || 'bronze'}</span>
									</span>
								</div>
							</div>

							<!-- Right: Stats -->
							<div class="flex flex-shrink-0 items-center gap-4 sm:gap-6">
								<!-- Streak -->
								<div class="text-center">
									<div
										class="inline-flex animate-pulse items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-400 to-red-500 px-4 py-2 font-bold text-white shadow-lg transition-transform duration-300 hover:scale-105"
									>
										<Flame class="h-5 w-5 {isTop3 ? 'animate-bounce' : ''}" />
										<span class="text-xl">{user.streak || 0}</span>
									</div>
									<p class="mt-1 text-xs font-medium text-gray-700 dark:text-slate-300">Streak</p>
								</div>

								<!-- XP -->
								<div class="relative text-center">
									<div
										class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 font-bold text-white shadow-lg transition-transform duration-300 hover:scale-105"
									>
										<Star class="h-5 w-5" />
										<span class="text-xl font-black">{user.xp || 0}</span>
									</div>
									<p class="mt-1 text-xs font-medium text-gray-700 dark:text-slate-300">XP</p>
									{#if isTop3}
										<div class="absolute -top-3 -right-3 animate-pulse">
											<div
												class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-yellow-400 to-amber-400 shadow-lg"
											>
												<Star class="h-4 w-4 text-white" />
											</div>
										</div>
									{/if}
								</div>

								<!-- Expand Icon -->
								<ChevronDown
									class={`h-6 w-6 text-gray-400 transition-transform duration-300 ${expandedUserId === user.userId ? 'rotate-180' : ''}`}
								/>
							</div>
						</div>

						<!-- Expanded Details -->
						{#if expandedUserId === user.userId}
							<div
								class="animate-scale-in mt-6 space-y-4 border-t-2 border-gray-200 pt-6 dark:border-slate-700"
							>
								<!-- Progress to next badge -->
								{#if progress}
									{@const ProgressIcon = getBadgeIconComponent(progress.next)}
									<div>
										<div class="mb-2 flex items-center justify-between">
											<span
												class="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-300"
											>
												<ProgressIcon class="h-4 w-4" />
												Progres către
												<span class="font-bold text-blue-600 capitalize dark:text-blue-400"
													>{progress.next}</span
												>
											</span>
											<span class="text-sm font-bold text-blue-600 dark:text-blue-400">
												{user.xp} / {progress.target} XP
											</span>
										</div>
										<div
											class="h-4 w-full overflow-hidden rounded-full border-2 border-gray-300 bg-gray-200 dark:border-slate-600 dark:bg-slate-700"
										>
											<div
												class="relative h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-purple-600 shadow-lg transition-all duration-700"
												style={`width: ${progress.progress}%`}
											>
												{#if progress.progress > 20}
													<div
														class="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-white to-transparent opacity-40"
													></div>
												{/if}
											</div>
										</div>
										<p class="mt-1 text-xs text-gray-600 dark:text-slate-400">
											<strong>{Math.round(progress.progress)}%</strong> complet - {Math.max(
												0,
												(progress.target || 0) - (user.xp || 0)
											)} XP rămase
										</p>
									</div>
								{:else}
									<div
										class="rounded-xl bg-gradient-to-r from-yellow-50 to-amber-50 py-4 text-center dark:from-yellow-950 dark:to-amber-950"
									>
										<Trophy class="mx-auto mb-2 h-12 w-12 animate-bounce text-yellow-500" />
										<p class="text-sm font-bold text-yellow-600 dark:text-yellow-400">
											🎉 Ai atins nivel MAXIM! 🎉
										</p>
										<p class="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
											Diamond - Nivelul cel mai înalt!
										</p>
									</div>
								{/if}

								<!-- Achievement Stats Grid -->
								<div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
									<div
										class="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4 text-center transition-transform duration-300 hover:scale-105 dark:from-blue-950 dark:to-indigo-950"
									>
										<Target class="mx-auto mb-1 h-6 w-6 text-blue-700 dark:text-blue-200" />
										<p class="text-xs font-medium text-blue-700 dark:text-blue-300">Poziție</p>
										<p class="text-2xl font-black text-blue-900 dark:text-blue-100">#{index + 1}</p>
									</div>
									<div
										class="rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 p-4 text-center transition-transform duration-300 hover:scale-105 dark:from-purple-950 dark:to-pink-950 {progress
											? ''
											: 'animate-badge-glow'}"
									>
										<BadgeIcon class="mx-auto mb-1 h-6 w-6 text-purple-700 dark:text-purple-200" />
										<p class="text-xs font-medium text-purple-700 dark:text-purple-300">Badge</p>
										<p class="text-sm font-black text-purple-900 capitalize dark:text-purple-100">
											{user.badge}
										</p>
									</div>
									<div
										class="rounded-xl bg-gradient-to-br from-orange-50 to-red-50 p-4 text-center transition-transform duration-300 hover:scale-105 dark:from-orange-950 dark:to-red-950"
									>
										<Flame
											class="mx-auto mb-1 h-6 w-6 text-orange-700 dark:text-orange-200 {(user.streak ||
												0) > 0
												? 'animate-pulse'
												: ''}"
										/>
										<p class="text-xs font-medium text-orange-700 dark:text-orange-300">Streak</p>
										<p class="text-2xl font-black text-orange-900 dark:text-orange-100">
											{user.streak || 0}
										</p>
									</div>
									<div
										class="rounded-xl bg-gradient-to-br from-yellow-50 to-amber-50 p-4 text-center transition-transform duration-300 hover:scale-105 dark:from-yellow-950 dark:to-amber-950"
									>
										<Star class="mx-auto mb-1 h-6 w-6 text-yellow-700 dark:text-yellow-200" />
										<p class="text-xs font-medium text-yellow-700 dark:text-yellow-300">Total XP</p>
										<p class="text-2xl font-black text-yellow-900 dark:text-yellow-100">
											{user.xp}
										</p>
									</div>
								</div>
							</div>
						{/if}
					</button>
				{/each}
			{/if}
		</div>

		<!-- Info Section -->
		<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
			<Card renderCustom unstyled containerClass="">
				<div class="mb-4 flex items-center gap-3">
					<div
						class="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 text-3xl shadow-lg"
					>
						<Star class="h-7 w-7 text-white" />
					</div>
					<h3 class="text-xl font-black text-gray-900 dark:text-slate-100">Cum se câștigă XP?</h3>
				</div>
				<p class="text-sm leading-relaxed text-gray-700 dark:text-slate-300">
					Primești XP prin confirmarea dozelor de medicament la timp și prin respectarea planului de
					tratament. Cu cât ești mai constant, cu atât câștigi mai mult XP!
				</p>
			</Card>

			<Card renderCustom unstyled containerClass="">
				<div class="mb-4 flex items-center gap-3">
					<div
						class="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-red-500 text-3xl shadow-lg"
					>
						<Flame class="h-7 w-7 text-white" />
					</div>
					<h3 class="text-xl font-black text-gray-900 dark:text-slate-100">Ce este Streak-ul?</h3>
				</div>
				<p class="text-sm leading-relaxed text-gray-700 dark:text-slate-300">
					Streak-ul măsoară numărul de zile consecutive în care ai confirmat toate dozele. Dacă sari
					o zi, streak-ul se resetează la 0. Continuitate = Succes!
				</p>
			</Card>

			<Card renderCustom unstyled containerClass="">
				<div class="mb-4 flex items-center gap-3">
					<div
						class="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 text-3xl shadow-lg"
					>
						<Trophy class="h-7 w-7 text-white" />
					</div>
					<h3 class="text-xl font-black text-gray-900 dark:text-slate-100">Badge-uri</h3>
				</div>
				<p class="text-sm leading-relaxed text-gray-700 dark:text-slate-300">
					Deblochează badge-uri pe măsură ce avansezi: Bronze (0 XP), Silver (500 XP), Gold (1500
					XP), Platinum (3000 XP), Diamond (5000 XP).
				</p>
			</Card>
		</div>
	</div>
</div>
