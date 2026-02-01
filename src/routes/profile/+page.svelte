<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { isPacient } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import { profileUpdateSchema, parseWithFriendlyErrors } from '$lib/validation/schemas';
	import { loadUserProfile } from '$lib/utils/loaders';
	import { Info, Star, Award, CheckCircle, BarChart3, Settings, Pill } from '@lucide/svelte';

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
			const profile = await loadUserProfile();
			user = profile.user;
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
					<h1 class="text-4xl font-bold text-gray-900">{user.fullName}</h1>
				<p class="text-lg text-black dark:text-white capitalize mt-1 font-medium">{user.role}</p>
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
			<div class="bg-white/90 dark:bg-gray-900/70 border border-slate-200/70 dark:border-gray-800/70 rounded-xl shadow-sm p-6">
				<div class="flex items-center gap-3 mb-4">
					<div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
						<Info class="w-6 h-6 text-blue-600 dark:text-blue-400" />
					</div>
					<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Informații cont</h2>
				</div>
				<div class="space-y-4">
					<div>
							<p class="text-sm text-gray-700 dark:text-gray-300 mb-1">Email</p>
						<p class="text-gray-900 dark:text-gray-100 font-medium">{user.email}</p>
					</div>
					<div>
							<p class="text-sm text-gray-700 dark:text-gray-300 mb-1">Rol</p>
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
				<div class="bg-white/90 dark:bg-gray-900/70 border border-slate-200/70 dark:border-gray-800/70 rounded-xl shadow-sm p-6">
					<div class="flex items-center gap-3 mb-4">
						<div class="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
							<Star class="w-6 h-6 text-purple-600 dark:text-purple-400" />
						</div>
						<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Realizări</h2>
					</div>
					<div class="space-y-4">
						<div class="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
							<div>
								<p class="text-sm text-gray-600 dark:text-gray-400">Zile consecutive</p>
								<p class="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.currentStreak}</p>
							</div>
							<BarChart3 class="w-8 h-8 text-blue-600 dark:text-blue-400" />
						</div>
						<div class="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
							<div>
								<p class="text-sm text-gray-600 dark:text-gray-400">Record streak</p>
								<p class="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.longestStreak}</p>
							</div>
							<Award class="w-8 h-8 text-purple-600 dark:text-purple-400" />
						</div>
					</div>
				</div>

				<!-- Badge Display -->
				<div class="bg-white/90 dark:bg-gray-900/70 border border-slate-200/70 dark:border-gray-800/70 rounded-xl shadow-sm p-6">
					<div class="flex items-center gap-3 mb-4">
						<div class="w-10 h-10 bg-gradient-to-br {getBadgeColor(stats.currentBadge)} rounded-lg flex items-center justify-center">
							<Award class="w-6 h-6 text-white" />
						</div>
						<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Badge curent</h2>
					</div>
					<div class="text-center py-4">
						<div class="w-24 h-24 mx-auto bg-gradient-to-br {getBadgeColor(stats.currentBadge)} rounded-full flex items-center justify-center mb-3 shadow-lg">
							<Award class="w-12 h-12 text-white" />
						</div>
						<p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{getBadgeName(stats.currentBadge)}</p>
						<p class="text-gray-600 dark:text-gray-400 mt-1">{stats.totalXp} XP</p>
					</div>
				</div>
			{:else}
				<!-- For Medics/Admins - Activity Summary -->
				<div class="bg-white/90 dark:bg-gray-900/70 border border-slate-200/70 dark:border-gray-800/70 rounded-xl shadow-sm p-6 md:col-span-2">
					<div class="flex items-center gap-3 mb-4">
						<div class="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
							<CheckCircle class="w-6 h-6 text-green-600 dark:text-green-400" />
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
				<a href="/settings" class="block p-4 bg-white/90 dark:bg-gray-900/70 border border-slate-200/70 dark:border-gray-800/70 rounded-xl shadow-sm hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 ease-in-out group">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center group-hover:scale-125 group-hover:rotate-12 transition-all duration-300 ease-in-out">
							<Settings class="w-6 h-6 text-blue-600 dark:text-blue-400" />
						</div>
						<div>
							<p class="font-semibold text-gray-900 dark:text-gray-100">Setări</p>
							<p class="text-sm text-gray-600 dark:text-gray-400">Configurează contul</p>
						</div>
					</div>
				</a>

				<a href="/dashboard" class="block p-4 bg-white/90 dark:bg-gray-900/70 border border-slate-200/70 dark:border-gray-800/70 rounded-xl shadow-sm hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 ease-in-out group">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center group-hover:scale-125 group-hover:rotate-12 transition-all duration-300 ease-in-out">
							<BarChart3 class="w-6 h-6 text-purple-600 dark:text-purple-400" />
						</div>
						<div>
							<p class="font-semibold text-gray-900 dark:text-gray-100">Dashboard</p>
							<p class="text-sm text-gray-600 dark:text-gray-400">Vezi statistici</p>
						</div>
					</div>
				</a>

				<a href="/treatments" class="block p-4 bg-white/90 dark:bg-gray-900/70 border border-slate-200/70 dark:border-gray-800/70 rounded-xl shadow-sm hover:border-green-400 dark:hover:border-green-500 hover:shadow-xl hover:shadow-green-500/10 hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 ease-in-out group">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center group-hover:scale-125 group-hover:rotate-12 transition-all duration-300 ease-in-out">
							<Pill class="w-6 h-6 text-green-600 dark:text-green-400" />
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
