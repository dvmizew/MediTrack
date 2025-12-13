<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { isPacient } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import { profileUpdateSchema, parseWithFriendlyErrors } from '$lib/validation/schemas';

	let loading = $state(true);
	let user = $state<any>(null);
	
	// Stats (for patients)
	let stats = $state({
		totalXp: 0,
		currentStreak: 0,
		longestStreak: 0,
		currentBadge: 'bronze',
		completedTreatments: 0,
		activeTreatments: 0
	});

	onMount(async () => {
		await loadProfile();
		if ($isPacient) {
			await loadStats();
		}
		loading = false;
	});

	// Reload profile when page becomes visible (user returns to tab/window)
	$effect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				loadProfile();
				if ($isPacient) {
					loadStats();
				}
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});

	async function loadProfile() {
		try {
			console.log('Loading profile from /users/me...');
			user = await api.getProfile();
			console.log('Profile loaded:', user);
		} catch (error) {
			console.error('Failed to load profile:', error);
		}
	}

	async function saveProfile(updates: { fullName?: string; email?: string; avatarUrl?: string }) {
		const parsed = parseWithFriendlyErrors(profileUpdateSchema, updates);
		if (!parsed.success) {
			console.error('Profile validation errors:', parsed.errors);
			return;
		}
		try {
			const updated = await api.updateProfile(parsed.data);
			user = { ...user, ...updated };
		} catch (error) {
			console.error('Failed to update profile:', error);
		}
	}

	async function loadStats() {
		try {
			const userData = await api.getProfile();
			stats = {
				totalXp: userData.totalXp || 0,
				currentStreak: userData.currentStreak || 0,
				longestStreak: userData.longestStreak || 0,
				currentBadge: userData.currentBadge || 'bronze',
				completedTreatments: 0,
				activeTreatments: 0
			};
		} catch (error) {
			console.error('Failed to load stats:', error);
		}
	}

	function getBadgeColor(badge: string) {
		const colors: Record<string, string> = {
			bronze: 'from-orange-600 to-orange-800',
			silver: 'from-gray-400 to-gray-600',
			gold: 'from-yellow-400 to-yellow-600',
			platinum: 'from-blue-400 to-blue-600',
			diamond: 'from-purple-500 to-purple-700'
		};
		return colors[badge] || colors.bronze;
	}

	function getBadgeName(badge: string) {
		const names: Record<string, string> = {
			bronze: 'Bronz',
			silver: 'Argint',
			gold: 'Aur',
			platinum: 'Platină',
			diamond: 'Diamant'
		};
		return names[badge] || 'Bronz';
	}
</script>

<main class="page-transition max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	{#if loading}
		<div class="flex items-center justify-center min-h-[400px]">
			<div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
		</div>
	{:else if user}
		<!-- Header -->
		<div class="mb-8">
			<div class="flex items-center gap-6">
				<div class="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
					{#if user.avatarUrl}
						<img src={user.avatarUrl} alt={user.fullName} class="w-full h-full rounded-full object-cover" />
					{:else}
						<span class="text-white text-4xl font-bold">{user.fullName.charAt(0).toUpperCase()}</span>
					{/if}
				</div>
				<div>
					<h1 class="text-4xl font-bold text-gray-900 dark:text-gray-100">{user.fullName}</h1>
					<p class="text-lg text-gray-600 dark:text-gray-400 capitalize mt-1">{user.role}</p>
					{#if $isPacient}
						<div class="flex items-center gap-4 mt-2">
							<span class="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium rounded-full">
								{stats.totalXp} XP
							</span>
							<span class="px-3 py-1 bg-gradient-to-r {getBadgeColor(stats.currentBadge)} text-white text-sm font-medium rounded-full">
								{getBadgeName(stats.currentBadge)}
							</span>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			<!-- Account Information -->
			<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
				<div class="flex items-center gap-3 mb-4">
					<div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
						<svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
						</svg>
					</div>
					<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Informații cont</h2>
				</div>
				<div class="space-y-4">
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400 mb-1">Email</p>
						<p class="text-gray-900 dark:text-gray-100 font-medium">{user.email}</p>
					</div>
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400 mb-1">Rol</p>
						<p class="text-gray-900 dark:text-gray-100 font-medium capitalize">{user.role}</p>
					</div>
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400 mb-1">Membru din</p>
						<p class="text-gray-900 dark:text-gray-100 font-medium">
							{new Date().toLocaleDateString('ro-RO', { year: 'numeric', month: 'long' })}
						</p>
					</div>
				</div>
			</div>

			{#if $isPacient}
				<!-- Patient Stats Card -->
				<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
					<div class="flex items-center gap-3 mb-4">
						<div class="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
							<svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 20 20">
								<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
							</svg>
						</div>
						<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Realizări</h2>
					</div>
					<div class="space-y-4">
						<div class="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
							<div>
								<p class="text-sm text-gray-600 dark:text-gray-400">Zile consecutive</p>
								<p class="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.currentStreak}</p>
							</div>
							<svg class="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
							</svg>
						</div>
						<div class="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
							<div>
								<p class="text-sm text-gray-600 dark:text-gray-400">Record streak</p>
								<p class="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.longestStreak}</p>
							</div>
							<svg class="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
							</svg>
						</div>
					</div>
				</div>

				<!-- Badge Display -->
				<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
					<div class="flex items-center gap-3 mb-4">
						<div class="w-10 h-10 bg-gradient-to-br {getBadgeColor(stats.currentBadge)} rounded-lg flex items-center justify-center">
							<svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
								<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
							</svg>
						</div>
						<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Badge curent</h2>
					</div>
					<div class="text-center py-4">
						<div class="w-24 h-24 mx-auto bg-gradient-to-br {getBadgeColor(stats.currentBadge)} rounded-full flex items-center justify-center mb-3 shadow-lg">
							<svg class="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
								<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
							</svg>
						</div>
						<p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{getBadgeName(stats.currentBadge)}</p>
						<p class="text-gray-600 dark:text-gray-400 mt-1">{stats.totalXp} XP</p>
					</div>
				</div>
			{:else}
				<!-- For Medics/Admins - Activity Summary -->
				<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 md:col-span-2">
					<div class="flex items-center gap-3 mb-4">
						<div class="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
							<svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
							</svg>
						</div>
						<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Activitate</h2>
					</div>
					<div class="grid grid-cols-2 gap-4">
						<div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
							<p class="text-sm text-gray-600 dark:text-gray-400 mb-1">Pacienți activi</p>
							<p class="text-3xl font-bold text-gray-900 dark:text-gray-100">-</p>
						</div>
						<div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
							<p class="text-sm text-gray-600 dark:text-gray-400 mb-1">Tratamente active</p>
							<p class="text-3xl font-bold text-gray-900 dark:text-gray-100">-</p>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Quick Actions -->
		<div class="mt-8">
			<h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Acțiuni rapide</h2>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<a href="/settings" class="block p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 ease-in-out group">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center group-hover:scale-125 group-hover:rotate-12 transition-all duration-300 ease-in-out">
							<svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
							</svg>
						</div>
						<div>
							<p class="font-semibold text-gray-900 dark:text-gray-100">Setări</p>
							<p class="text-sm text-gray-600 dark:text-gray-400">Configurează contul</p>
						</div>
					</div>
				</a>

				<a href="/dashboard" class="block p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 ease-in-out group">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center group-hover:scale-125 group-hover:rotate-12 transition-all duration-300 ease-in-out">
							<svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
							</svg>
						</div>
						<div>
							<p class="font-semibold text-gray-900 dark:text-gray-100">Dashboard</p>
							<p class="text-sm text-gray-600 dark:text-gray-400">Vezi statistici</p>
						</div>
					</div>
				</a>

				<a href="/treatments" class="block p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:border-green-400 dark:hover:border-green-500 hover:shadow-xl hover:shadow-green-500/10 hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 ease-in-out group">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center group-hover:scale-125 group-hover:rotate-12 transition-all duration-300 ease-in-out">
							<svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
							</svg>
						</div>
						<div>
							<p class="font-semibold text-gray-900 dark:text-gray-100">Tratamente</p>
							<p class="text-sm text-gray-600 dark:text-gray-400">Gestionează tratamentele</p>
						</div>
					</div>
				</a>
			</div>
		</div>
	{/if}
</main>
