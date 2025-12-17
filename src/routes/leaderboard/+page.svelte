<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore, isPacient } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import { notificationService } from '$lib/services/notificationService';

	let loading = $state(true);
	let leaderboard = $state<any[]>([]);
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
			notificationService.error('Eroare', 'Trebuie să fii autentificat', 5000);
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
			if ($authStore.user && $isPacient) {
				currentUserPosition = leaderboard.findIndex(
					(u) => u.userId === $authStore.user.id
				);
			}
		} catch (error) {
			console.error('Failed to load leaderboard:', error);
			notificationService.error(
				'Eroare',
				'Nu s-a putut încărca leaderboard-ul',
				5000
			);
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

	function getBadgeIcon(badge: string | null) {
		const badges: Record<string, string> = {
			bronze: '🥉',
			silver: '🥈',
			gold: '🥇',
			platinum: '💎',
			diamond: '⭐'
		};
		return badges[badge || 'bronze'] || '🎖️';
	}

	function getBadgeColor(badge: string | null) {
		const colors: Record<string, string> = {
			bronze: 'bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700',
			silver: 'bg-slate-100 dark:bg-slate-900/30 text-slate-900 dark:text-slate-300 border-slate-300 dark:border-slate-700',
			gold: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
			platinum: 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300 border-blue-300 dark:border-blue-700',
			diamond: 'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-700'
		};
		return colors[badge || 'bronze'] || 'bg-gray-100 text-gray-900 border-gray-300';
	}

	function getRankMedal(position: number) {
		if (position === 0) return '🥇';
		if (position === 1) return '🥈';
		if (position === 2) return '🥉';
		return `#${position + 1}`;
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
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 sm:p-6 page-transition">
	<div class="max-w-6xl mx-auto">
		<!-- Header -->
		<div class="mb-8 text-center">
			<div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full shadow-lg mb-4">
				<span class="text-4xl">🏆</span>
			</div>
			<h1 class="text-4xl sm:text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
				Leaderboard
			</h1>
		</div>

		<!-- Filter Buttons -->
		<div class="flex justify-center gap-3 mb-4 flex-wrap">
			<button
				onclick={() => changeFilter('all')}
				class={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform ${
					timeFilter === 'all'
						? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl scale-105 ring-4 ring-blue-200 dark:ring-blue-900'
						: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-2 border-gray-200 dark:border-gray-700 hover:shadow-lg hover:scale-105 hover:border-blue-300'
				}`}
			>
				🌟 All time
			</button>
			<button
				onclick={() => changeFilter('week')}
				class={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform ${
					timeFilter === 'week'
						? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl scale-105 ring-4 ring-blue-200 dark:ring-blue-900'
						: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-2 border-gray-200 dark:border-gray-700 hover:shadow-lg hover:scale-105 hover:border-blue-300'
				}`}
			>
				📅 Săptămâna
			</button>
			<button
				onclick={() => changeFilter('month')}
				class={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform ${
					timeFilter === 'month'
						? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl scale-105 ring-4 ring-blue-200 dark:ring-blue-900'
						: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-2 border-gray-200 dark:border-gray-700 hover:shadow-lg hover:scale-105 hover:border-blue-300'
				}`}
			>
				📆 Lună
			</button>
		</div>

		<!-- Refresh Button -->
		<div class="flex justify-center mb-8">
			<button
				onclick={() => loadLeaderboard()}
				disabled={refreshing}
				class="px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-2 border-gray-200 dark:border-gray-700 hover:shadow-lg hover:scale-105 hover:border-green-300 disabled:opacity-50"
			>
				{#if refreshing}
					<span class="inline-block animate-spin">🔄</span>
				{:else}
					🔄 Refresh
				{/if}
			</button>
		</div>

		<!-- Current User Position (if patient) -->
		{#if $isPacient && currentUserPosition >= 0}
			<div class="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-2xl p-8 mb-8 shadow-2xl transform hover:scale-105 transition-all duration-300">
				<div class="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
				<div class="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24"></div>
				<div class="relative flex items-center justify-between">
					<div>
						<p class="text-sm font-medium opacity-90 mb-1">🎯 Poziția ta în clasament</p>
						<p class="text-5xl sm:text-6xl font-black mt-2 drop-shadow-lg">#{currentUserPosition + 1}</p>
						{#if leaderboard[currentUserPosition]}
							<div class="mt-4 flex items-center gap-4">
								<div class="flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-2 rounded-full">
									<span>⭐</span>
									<span class="font-bold">{leaderboard[currentUserPosition].xp} XP</span>
								</div>
								<div class="flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-2 rounded-full">
									<span>🔥</span>
									<span class="font-bold">{leaderboard[currentUserPosition].streak} streak</span>
								</div>
							</div>
						{/if}
					</div>
					<div class="text-7xl sm:text-8xl drop-shadow-2xl animate-pulse">{getRankMedal(currentUserPosition)}</div>
				</div>
			</div>
		{/if}

		<!-- Leaderboard Cards -->
		<div class="space-y-4 mb-8">
			{#if loading && !refreshing}
				<div class="p-12 text-center bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
					<div class="inline-block animate-spin">
						<svg class="w-16 h-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
						</svg>
					</div>
					<p class="mt-4 text-gray-600 dark:text-gray-400 font-medium">Se încarcă leaderboard-ul...</p>
				</div>
			{:else if leaderboard.length === 0}
				<div class="p-12 text-center bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
					<span class="text-6xl mb-4 block">🏆</span>
					<p class="text-xl text-gray-600 dark:text-gray-400 font-medium">
						Nu au fost găsiți pacienți pe leaderboard
					</p>
				</div>
			{:else}
				{#each leaderboard as user, index (user.userId)}
					{@const isCurrentUser = $authStore.user?.id === user.userId}
					{@const isTop3 = index < 3}
					{@const progress = getProgressToNextBadge(user.xp, user.badge)}
					
					<button
						onclick={() => toggleUserDetails(user.userId)}
						class={`w-full text-left transition-all duration-300 transform hover:scale-102 ${
							isTop3
								? index === 0
									? 'bg-gradient-to-r from-yellow-50 via-amber-50 to-orange-50 dark:from-yellow-900/20 dark:via-amber-900/20 dark:to-orange-900/20 ring-4 ring-yellow-300 dark:ring-yellow-700'
									: index === 1
										? 'bg-gradient-to-r from-slate-50 via-gray-50 to-zinc-50 dark:from-slate-900/20 dark:via-gray-900/20 dark:to-zinc-900/20 ring-4 ring-slate-300 dark:ring-slate-700'
										: 'bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-900/20 dark:via-amber-900/20 dark:to-yellow-900/20 ring-4 ring-orange-300 dark:ring-orange-700'
								: isCurrentUser
									? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 ring-2 ring-blue-400 dark:ring-blue-600'
									: 'bg-white dark:bg-gray-800 hover:shadow-xl'
		} rounded-2xl shadow-lg p-6`}
					>
						<div class="flex items-center justify-between gap-4">
							<!-- Left: Rank + Avatar + Name -->
							<div class="flex items-center gap-4 min-w-0 flex-1">
								<!-- Rank Badge -->
								<div class={`flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center font-black text-2xl ${
									isTop3 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg animate-pulse' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
								}`}>
									{index < 3 ? getRankMedal(index) : `#${index + 1}`}
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
											⭐
										</div>
									{/if}
								</div>

								<!-- Name + Badge -->
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2 mb-1">
										<p class="font-bold text-lg text-gray-900 dark:text-white truncate">
											{user.name || 'User'}
										</p>
										{#if isCurrentUser}
											<span class="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full">TU</span>
										{/if}
									</div>
									<span class={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border-2 ${getBadgeColor(user.badge)}`}>
										<span class="text-base">{getBadgeIcon(user.badge)}</span>
										<span class="capitalize">{user.badge || 'bronze'}</span>
									</span>
								</div>
							</div>

							<!-- Right: Stats -->
							<div class="flex items-center gap-4 sm:gap-6 flex-shrink-0">
								<!-- Streak -->
								<div class="text-center">
									<div class="inline-flex items-center gap-1.5 bg-gradient-to-r from-orange-400 to-red-500 text-white px-4 py-2 rounded-xl font-bold shadow-lg">
										<span class="text-xl">🔥</span>
										<span class="text-xl">{user.streak || 0}</span>
									</div>
									<p class="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">Streak</p>
								</div>

								<!-- XP -->
								<div class="text-center">
									<div class="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg">
										<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
											<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
										</svg>
										<span class="text-xl">{user.xp || 0}</span>
									</div>
									<p class="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">XP</p>
								</div>

								<!-- Expand Icon -->
								<svg class={`w-6 h-6 text-gray-400 transition-transform duration-300 ${expandedUserId === user.userId ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
								</svg>
							</div>
						</div>

						<!-- Expanded Details -->
						{#if expandedUserId === user.userId}
							<div class="mt-6 pt-6 border-t-2 border-gray-200 dark:border-gray-700 space-y-4 animate-scale-in">
								<!-- Progress to next badge -->
								{#if progress}
									<div>
										<div class="flex items-center justify-between mb-2">
											<span class="text-sm font-semibold text-gray-700 dark:text-gray-300">
												Progres către {getBadgeIcon(progress.next)} {progress.next}
											</span>
											<span class="text-sm font-bold text-blue-600 dark:text-blue-400">
												{user.xp} / {progress.target} XP
											</span>
										</div>
										<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
											<div 
												class="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500"
												style={`width: ${progress.progress}%`}
											></div>
										</div>
									</div>
								{:else}
									<div class="text-center py-2">
										<span class="text-2xl">🏆</span>
										<p class="text-sm font-bold text-purple-600 dark:text-purple-400 mt-1">
											Ai atins nivelul maxim!
										</p>
									</div>
								{/if}

								<!-- Achievement Stats Grid -->
								<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
									<div class="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 text-center">
										<p class="text-2xl mb-1">🎯</p>
										<p class="text-xs text-gray-600 dark:text-gray-400 font-medium">Poziție</p>
										<p class="text-xl font-black text-gray-900 dark:text-white">#{index + 1}</p>
									</div>
									<div class="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 text-center">
										<p class="text-2xl mb-1">{getBadgeIcon(user.badge)}</p>
										<p class="text-xs text-gray-600 dark:text-gray-400 font-medium">Badge</p>
										<p class="text-sm font-black text-gray-900 dark:text-white capitalize">{user.badge}</p>
									</div>
									<div class="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl p-4 text-center">
										<p class="text-2xl mb-1">🔥</p>
										<p class="text-xs text-gray-600 dark:text-gray-400 font-medium">Streak</p>
										<p class="text-xl font-black text-gray-900 dark:text-white">{user.streak}</p>
									</div>
									<div class="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-xl p-4 text-center">
										<p class="text-2xl mb-1">⭐</p>
										<p class="text-xs text-gray-600 dark:text-gray-400 font-medium">Total XP</p>
										<p class="text-xl font-black text-gray-900 dark:text-white">{user.xp}</p>
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
			<div class="group bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-2 border-transparent hover:border-blue-400">
				<div class="flex items-center gap-3 mb-4">
					<div class="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform">
						⭐
					</div>
					<h3 class="font-black text-xl text-gray-900 dark:text-white">Cum se câștigă XP?</h3>
				</div>
				<p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
					Primești XP prin confirmarea dozelor de medicament la timp și prin respectarea planului de tratament. Cu cât ești mai constant, cu atât câștigi mai mult XP!
				</p>
			</div>

			<div class="group bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-2 border-transparent hover:border-orange-400">
				<div class="flex items-center gap-3 mb-4">
					<div class="w-14 h-14 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform">
						🔥
					</div>
					<h3 class="font-black text-xl text-gray-900 dark:text-white">Ce este Streak-ul?</h3>
				</div>
				<p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
					Streak-ul măsoară numărul de zile consecutive în care ai confirmat toate dozele. Dacă sari o zi, streak-ul se resetează la 0. Continuitate = Succes!
				</p>
			</div>

			<div class="group bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-2 border-transparent hover:border-purple-400">
				<div class="flex items-center gap-3 mb-4">
					<div class="w-14 h-14 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform">
						🏆
					</div>
					<h3 class="font-black text-xl text-gray-900 dark:text-white">Badge-uri</h3>
				</div>
				<p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
					Deblochează badge-uri pe măsură ce avansezi: 🥉 Bronze (0 XP), 🥈 Silver (500 XP), 🥇 Gold (1500 XP), 💎 Platinum (3000 XP), ⭐ Diamond (5000 XP).
				</p>
			</div>
		</div>
	</div>
</div>
