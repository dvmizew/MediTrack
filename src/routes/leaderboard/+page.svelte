<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore, isPacient } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import type { LeaderboardEntry } from '$lib/types/api';
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
			await new Promise(resolve => setTimeout(resolve, 500));
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
			bronze: 'bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700',
			silver: 'bg-slate-100 dark:bg-slate-900/30 text-slate-900 dark:text-slate-300 border-slate-300 dark:border-slate-700',
			gold: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
			platinum: 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300 border-blue-300 dark:border-blue-700',
			diamond: 'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-700'
		};
		return colors[badge || 'bronze'] || 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-slate-100 border-gray-300 dark:border-slate-700';
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

<div class="min-h-screen bg-transparent p-4 sm:p-6 page-transition">
	<div class="max-w-6xl mx-auto">
		<!-- Header -->
		<div class="mb-8 text-center">
			<div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full shadow-lg mb-4">
				<Trophy class="w-10 h-10 text-white" />
			</div>
			<h1 class="text-4xl sm:text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
				Leaderboard
			</h1>
			<p class="text-sm sm:text-base text-gray-900 dark:text-slate-100 font-medium">Clasament pacienți, progres individual și realizări colective</p>
		</div>

		<!-- Filter Buttons -->
		<div class="flex justify-center gap-3 mb-4 flex-wrap">
			<button
				onclick={() => changeFilter('all')}
				class={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform ${
					timeFilter === 'all'
						? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl scale-105 ring-4 ring-blue-200 dark:ring-blue-900'
						: 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm text-gray-900 dark:text-slate-100 border-2 border-slate-200 dark:border-slate-700 hover:shadow-lg hover:scale-105 hover:border-blue-300'
				}`}
			>
				<span class="inline-flex items-center gap-2">
					<Sparkles class="w-4 h-4" />
					All time
				</span>
			</button>
			<button
				onclick={() => changeFilter('week')}
				class={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform ${
					timeFilter === 'week'
						? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl scale-105 ring-4 ring-blue-200 dark:ring-blue-900'
						: 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm text-gray-900 dark:text-slate-100 border-2 border-slate-200 dark:border-slate-700 hover:shadow-lg hover:scale-105 hover:border-blue-300'
				}`}
			>
				<span class="inline-flex items-center gap-2">
					<CalendarDays class="w-4 h-4" />
					Săptămâna
				</span>
			</button>
			<button
				onclick={() => changeFilter('month')}
				class={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform ${
					timeFilter === 'month'
						? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl scale-105 ring-4 ring-blue-200 dark:ring-blue-900'
						: 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm text-gray-900 dark:text-slate-100 border-2 border-slate-200 dark:border-slate-700 hover:shadow-lg hover:scale-105 hover:border-blue-300'
				}`}
			>
				<span class="inline-flex items-center gap-2">
					<Calendar class="w-4 h-4" />
					Lună
				</span>
			</button>
		</div>

		<!-- Refresh Button -->
		<div class="flex justify-center mb-8">
			<button
				onclick={() => loadLeaderboard()}
				disabled={refreshing}
				class="px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm text-gray-900 dark:text-slate-100 border-2 border-slate-200 dark:border-slate-700 hover:shadow-lg hover:scale-105 hover:border-green-300 disabled:opacity-50"
			>
				{#if refreshing}
					<RefreshCw class="w-4 h-4 animate-spin" />
				{:else}
					<span class="inline-flex items-center gap-2">
						<RefreshCw class="w-4 h-4" />
						Refresh
					</span>
				{/if}
			</button>
		</div>

		<!-- Current User Position (if patient) -->
		{#if $isPacient && currentUserPosition >= 0}
			<div class="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-2xl p-8 mb-8 shadow-2xl transition-all duration-300">
				<div class="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
				<div class="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24"></div>
				<div class="relative flex items-center justify-between">
					<div>
						<p class="text-sm font-medium opacity-90 mb-1 inline-flex items-center gap-2">
							<Target class="w-4 h-4" />
							Poziția ta în clasament
						</p>
						<p class="text-5xl sm:text-6xl font-black mt-2 drop-shadow-lg">#{currentUserPosition + 1}</p>
						{#if leaderboard[currentUserPosition]}
							<div class="mt-4 flex items-center gap-4">
								<div class="flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-2 rounded-full">
									<Star class="w-4 h-4" />
									<span class="font-bold">{leaderboard[currentUserPosition].xp} XP</span>
								</div>
								<div class="flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-2 rounded-full">
									<Flame class="w-4 h-4" />
									<span class="font-bold">{leaderboard[currentUserPosition].streak} streak</span>
								</div>
							</div>
						{/if}
					</div>
					<div class="text-7xl sm:text-8xl drop-shadow-2xl animate-pulse">
					{#snippet medalIcon()}
						{@const Icon = getRankMedalIcon(currentUserPosition)}
						<Icon class="w-16 h-16 sm:w-20 sm:h-20 text-white" />
					{/snippet}
					{@render medalIcon()}
					</div>
				</div>
			</div>
		{/if}

		<!-- Badge thresholds overview -->
		<div class="bg-gradient-to-r from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-950 dark:via-blue-950 dark:to-indigo-950 rounded-2xl shadow-lg p-8 mb-8 border-2 border-purple-200 dark:border-purple-800">
			<div class="flex flex-col gap-2 mb-6">
				<div class="flex items-center gap-2">
					<Sparkles class="w-6 h-6 text-purple-600 dark:text-purple-400" />
					<h2 class="text-2xl font-black text-purple-900 dark:text-purple-100">Badge-uri & praguri XP</h2>
				</div>
				<p class="text-sm text-purple-800 dark:text-purple-200">
					Acesta este ghidul de niveluri: fiecare badge se deblochează la un prag de XP.
				</p>
			</div>
			<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
				{#each badgeShowcase as badge}
					{@const badgeIcon = getBadgeIconComponent(badge.key)}
					{@const badgeColor = getBadgeColor(badge.key)}
					{@const Icon = badgeIcon}
					<div class="text-center p-4 bg-white/70 dark:bg-slate-800/70 rounded-xl backdrop-blur border-2 border-transparent hover:border-purple-400 transition-transform duration-300 hover:scale-105">
						<div class="flex justify-center mb-2">
							<div class={`p-3 rounded-full ${badgeColor}`}>
								<Icon class="w-6 h-6 text-white" />
							</div>
						</div>
						<p class="text-sm font-bold text-gray-900 dark:text-slate-100">{badge.label}</p>
						<p class="text-xs text-gray-600 dark:text-slate-300 mt-1">{badge.xp}</p>
						<p class="text-[11px] text-gray-500 dark:text-slate-400 mt-1">{badge.hint}</p>
					</div>
				{/each}
			</div>
		</div>

		<!-- Leaderboard Cards -->
		<div class="space-y-4 mb-8">
			{#if loading && !refreshing}
			<div class="p-12 text-center bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-2xl shadow-lg">
				<div class="inline-block animate-spin">
					<LoaderCircle class="w-16 h-16 text-blue-600" />
				</div>
					<p class="mt-4 text-gray-900 dark:text-slate-100 font-medium">Se încarcă leaderboard-ul...</p>
				</div>
			{:else if leaderboard.length === 0}
			<div class="p-12 text-center bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-2xl shadow-lg">
				<Trophy class="w-14 h-14 mx-auto mb-4 text-yellow-500" />
					<p class="text-xl text-gray-900 dark:text-slate-100 font-medium">
						Nu au fost găsiți pacienți pe leaderboard
					</p>
				</div>
			{:else}
				{#each leaderboard as user, index (user.userId)}
					{@const isCurrentUser = $authStore.user?.id === user.userId}
					{@const isTop3 = index < 3}
					{@const BadgeIcon = getBadgeIconComponent(user.badge)}
					{@const progress = getProgressToNextBadge(user.xp ?? user.totalXp, user.badge)}
					
					<button
						onclick={() => toggleUserDetails(user.userId)}
						class={`w-full text-left transition-all duration-300 transform hover:scale-102 ${
							isTop3
								? index === 0
									? 'bg-gradient-to-r from-yellow-50 via-amber-50 to-orange-50 dark:from-yellow-950 dark:via-amber-950 dark:to-orange-950 ring-4 ring-yellow-300 dark:ring-yellow-700/50'
									: index === 1
										? 'bg-gradient-to-r from-slate-50 via-gray-50 to-zinc-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 ring-4 ring-slate-300 dark:ring-slate-700/50'
										: 'bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-950 dark:via-amber-950 dark:to-yellow-950 ring-4 ring-orange-300 dark:ring-orange-700/50'
								: isCurrentUser
									? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 ring-2 ring-blue-400 dark:ring-blue-600/50'
									: 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 dark:shadow-lg hover:shadow-xl'
		} rounded-2xl shadow-lg p-6`}
					>
						<div class="flex items-center justify-between gap-4">
							<!-- Left: Rank + Avatar + Name -->
							<div class="flex items-center gap-4 min-w-0 flex-1">
								<!-- Rank Badge -->
								<div class={`flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center font-black text-2xl ${
									isTop3 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg animate-pulse' : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200'
								}`}>
									{#if index < 3}
										{@const Icon = getRankMedalIcon(index)}
										<Icon class="w-7 h-7 text-white" />
									{:else}
										#{index + 1}
									{/if}
								</div>

								<!-- Avatar -->
								<div class="relative flex-shrink-0">
									<div class={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg ${
										isTop3 ? 'bg-gradient-to-br from-purple-500 to-pink-500 ring-4 ring-purple-200 dark:ring-purple-800' : 'bg-gradient-to-br from-blue-500 to-purple-600'
									}`}>
										{user.name?.charAt(0).toUpperCase() || 'U'}
									</div>
									{#if isTop3}
										<div class="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-xs animate-bounce">
											<Star class="w-3.5 h-3.5 text-white" />
										</div>
									{/if}
								</div>

								<!-- Name + Badge -->
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2 mb-1">
										<p class="font-bold text-lg text-gray-900 dark:text-slate-100 truncate">
											{user.name || 'User'}
										</p>
										{#if isCurrentUser}
											<span class="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full">TU</span>
										{/if}
									</div>
									<span class={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border-2 ${getBadgeColor(user.badge)}`}>
									<BadgeIcon class="w-4 h-4" />
										<span class="capitalize">{user.badge || 'bronze'}</span>
									</span>
								</div>
							</div>

							<!-- Right: Stats -->
							<div class="flex items-center gap-4 sm:gap-6 flex-shrink-0">
								<!-- Streak -->
								<div class="text-center">
									<div class="inline-flex items-center gap-1.5 bg-gradient-to-r from-orange-400 to-red-500 text-white px-4 py-2 rounded-xl font-bold shadow-lg hover:scale-105 transition-transform duration-300 animate-pulse">
										<Flame class="w-5 h-5 {isTop3 ? 'animate-bounce' : ''}" />
										<span class="text-xl">{user.streak || 0}</span>
									</div>
											<p class="text-xs text-gray-700 dark:text-slate-300 mt-1 font-medium">Streak</p>
								</div>

								<!-- XP -->
								<div class="text-center relative">
									<div class="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg hover:scale-105 transition-transform duration-300">
										<Star class="w-5 h-5" />
										<span class="text-xl font-black">{user.xp || 0}</span>
									</div>
											<p class="text-xs text-gray-700 dark:text-slate-300 mt-1 font-medium">XP</p>
									{#if isTop3}
										<div class="absolute -top-3 -right-3 animate-pulse">
											<div class="w-8 h-8 bg-gradient-to-r from-yellow-400 to-amber-400 rounded-full flex items-center justify-center shadow-lg">
												<Star class="w-4 h-4 text-white" />
											</div>
										</div>
									{/if}
								</div>

								<!-- Expand Icon -->
								<ChevronDown class={`w-6 h-6 text-gray-400 transition-transform duration-300 ${expandedUserId === user.userId ? 'rotate-180' : ''}`} />
							</div>
						</div>

						<!-- Expanded Details -->
						{#if expandedUserId === user.userId}
							<div class="mt-6 pt-6 border-t-2 border-gray-200 dark:border-slate-700 space-y-4 animate-scale-in">
								<!-- Progress to next badge -->
								{#if progress}
									{@const ProgressIcon = getBadgeIconComponent(progress.next)}
									<div>
										<div class="flex items-center justify-between mb-2">
												<span class="text-sm font-semibold text-gray-700 dark:text-slate-300 inline-flex items-center gap-2">
													<ProgressIcon class="w-4 h-4" />
													Progres către <span class="capitalize font-bold text-blue-600 dark:text-blue-400">{progress.next}</span>
												</span>
											<span class="text-sm font-bold text-blue-600 dark:text-blue-400">
												{user.xp} / {progress.target} XP
											</span>
										</div>
												<div class="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden border-2 border-gray-300 dark:border-slate-600">
											<div 
												class="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-purple-600 rounded-full transition-all duration-700 relative shadow-lg"
												style={`width: ${progress.progress}%`}
											>
												{#if progress.progress > 20}
													<div class="absolute inset-0 opacity-40 bg-gradient-to-r from-white to-transparent animate-pulse rounded-full"></div>
												{/if}
											</div>
										</div>
										<p class="text-xs text-gray-600 dark:text-slate-400 mt-1">
											<strong>{Math.round(progress.progress)}%</strong> complet - {Math.max(0, (progress.target || 0) - (user.xp || 0))} XP rămase
										</p>
									</div>
								{:else}
									<div class="text-center py-4 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950 dark:to-amber-950 rounded-xl">
										<Trophy class="w-12 h-12 mx-auto text-yellow-500 animate-bounce mb-2" />
										<p class="text-sm font-bold text-yellow-600 dark:text-yellow-400">
											🎉 Ai atins nivel MAXIM! 🎉
										</p>
										<p class="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
											Diamond - Nivelul cel mai înalt!
										</p>
									</div>
								{/if}

								<!-- Achievement Stats Grid -->
								<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
											<div class="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-xl p-4 text-center hover:scale-105 transition-transform duration-300">
												<Target class="w-6 h-6 mx-auto mb-1 text-blue-700 dark:text-blue-200" />
												<p class="text-xs text-blue-700 dark:text-blue-300 font-medium">Poziție</p>
												<p class="text-2xl font-black text-blue-900 dark:text-blue-100">#{index + 1}</p>
										</div>
											<div class="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 rounded-xl p-4 text-center hover:scale-105 transition-transform duration-300 {progress ? '' : 'animate-badge-glow'}">
												<BadgeIcon class="w-6 h-6 mx-auto mb-1 text-purple-700 dark:text-purple-200" />
												<p class="text-xs text-purple-700 dark:text-purple-300 font-medium">Badge</p>
												<p class="text-sm font-black text-purple-900 dark:text-purple-100 capitalize">{user.badge}</p>
										</div>
											<div class="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 rounded-xl p-4 text-center hover:scale-105 transition-transform duration-300">
												<Flame class="w-6 h-6 mx-auto mb-1 text-orange-700 dark:text-orange-200 {(user.streak || 0) > 0 ? 'animate-pulse' : ''}" />
												<p class="text-xs text-orange-700 dark:text-orange-300 font-medium">Streak</p>
												<p class="text-2xl font-black text-orange-900 dark:text-orange-100">{user.streak || 0}</p>
										</div>
											<div class="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950 dark:to-amber-950 rounded-xl p-4 text-center hover:scale-105 transition-transform duration-300">
												<Star class="w-6 h-6 mx-auto mb-1 text-yellow-700 dark:text-yellow-200" />
												<p class="text-xs text-yellow-700 dark:text-yellow-300 font-medium">Total XP</p>
												<p class="text-2xl font-black text-yellow-900 dark:text-yellow-100">{user.xp}</p>
										</div>
								</div>
							</div>
						{/if}
					</button>
				{/each}
			{/if}
		</div>

		<!-- Info Section -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
		<div class="group bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-sm dark:shadow-lg">
				<div class="flex items-center gap-3 mb-4">
					<div class="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-3xl shadow-lg">
						<Star class="w-7 h-7 text-white" />
					</div>
					<h3 class="font-black text-xl text-gray-900 dark:text-slate-100">Cum se câștigă XP?</h3>
				</div>
								<p class="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
					Primești XP prin confirmarea dozelor de medicament la timp și prin respectarea planului de tratament. Cu cât ești mai constant, cu atât câștigi mai mult XP!
				</p>
			</div>

		<div class="group bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-sm dark:shadow-lg">
				<div class="flex items-center gap-3 mb-4">
					<div class="w-14 h-14 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center text-3xl shadow-lg">
						<Flame class="w-7 h-7 text-white" />
					</div>
					<h3 class="font-black text-xl text-gray-900 dark:text-slate-100">Ce este Streak-ul?</h3>
				</div>
				<p class="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
					Streak-ul măsoară numărul de zile consecutive în care ai confirmat toate dozele. Dacă sari o zi, streak-ul se resetează la 0. Continuitate = Succes!
				</p>
			</div>

		<div class="group bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-sm dark:shadow-lg">
				<div class="flex items-center gap-3 mb-4">
					<div class="w-14 h-14 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center text-3xl shadow-lg">
						<Trophy class="w-7 h-7 text-white" />
					</div>
					<h3 class="font-black text-xl text-gray-900 dark:text-slate-100">Badge-uri</h3>
				</div>
			<p class="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
				Deblochează badge-uri pe măsură ce avansezi: Bronze (0 XP), Silver (500 XP), Gold (1500 XP), Platinum (3000 XP), Diamond (5000 XP).
			</p>
			</div>
		</div>
	</div>
</div>
