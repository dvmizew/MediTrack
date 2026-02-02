<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';
	import { authStore } from '$lib/stores/auth';
	import { AlertCircle, ArrowLeft, MessageCircle, Info, Star, TrendingUp, Award, CheckCircle2 } from '@lucide/svelte';

	let userId = $derived($page.params.userId);
	let loading = $state(true);
	let user = $state<any>(null);
	let error = $state<string | null>(null);
	
	// Stats (for patient profiles)
	let stats = $state({
		totalXp: 0,
		currentStreak: 0,
		longestStreak: 0,
		currentBadge: 'bronze',
		completedTreatments: 0,
		activeTreatments: 0
	});

	onMount(async () => {
		await loadUserProfile();
		loading = false;
	});

	async function loadUserProfile() {
		try {
			// Check if viewing own profile - compare as numbers
			const currentUserId = $authStore.user?.id;
			const profileUserId = parseInt(userId || '0');
			
			if (currentUserId === profileUserId) {
				goto('/profile');
				return;
			}

			// Load other user's profile using API client
			const userData = await api.getUserProfile(userId || '');
			if (!userData) {
				throw new Error('Nu s-a putut încărca profilul');
			}
			
			user = userData;
			
			// Load stats if user is a patient
			if (user.role === 'pacient') {
				stats = {
					totalXp: user.totalXp || 0,
					currentStreak: user.currentStreak || 0,
					longestStreak: user.longestStreak || 0,
					currentBadge: user.currentBadge || 'bronze',
					completedTreatments: user.completedTreatments || 0,
					activeTreatments: user.activeTreatments || 0
				};
			}
		} catch (err: any) {
			console.error('Failed to load user profile:', err);
			error = err.message || 'Eroare la încărcarea profilului';
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

	function startChat() {
		goto(`/chat/${userId}`);
	}
</script>

<main class="page-transition max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	{#if loading}
		<div class="flex items-center justify-center min-h-[400px]">
			<div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
		</div>
	{:else if error}
		<div class="max-w-md mx-auto">
			<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
				<div class="w-16 h-16 mx-auto mb-4 text-red-500">
					<AlertCircle class="w-full h-full" />
				</div>
				<h2 class="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">Profil indisponibil</h2>
				<p class="text-gray-700 dark:text-slate-300 mb-4">{error}</p>
				<button 
					onclick={() => goto('/chat')}
					class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
				>
					Înapoi la chat
				</button>
			</div>
		</div>
	{:else if user}
		<!-- Back Button -->
		<button 
			onclick={() => window.history.back()}
			class="mb-6 flex items-center gap-2 text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 transition-colors"
		>
			<ArrowLeft class="w-5 h-5" />
			Înapoi
		</button>

		<!-- Header -->
		<div class="mb-8">
			<div class="flex items-center justify-between gap-6">
				<div class="flex items-center gap-6">
					<div class="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
						{#if user.avatarUrl}
							<img src={user.avatarUrl} alt={user.fullName} class="w-full h-full rounded-full object-cover" />
						{:else}
							<span class="text-white text-4xl font-bold">{user.fullName?.charAt(0).toUpperCase()}</span>
						{/if}
					</div>
					<div>
						<h1 class="text-4xl font-bold text-gray-900 dark:text-slate-100">{user.fullName}</h1>
							<p class="text-lg text-gray-700 dark:text-slate-300 capitalize mt-1">{user.role}</p>
						{#if user.role === 'pacient'}
							<div class="flex items-center gap-4 mt-2">
								<span class="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium rounded-full">
								{stats?.totalXp ?? 0} XP
								</span>
								<span class="px-3 py-1 bg-gradient-to-r {getBadgeColor(stats.currentBadge)} text-white text-sm font-medium rounded-full">
									{getBadgeName(stats.currentBadge)}
								</span>
							</div>
						{/if}
					</div>
				</div>

				<!-- Chat Button -->
				<button 
					onclick={startChat}
					class="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
				>
					<MessageCircle class="w-5 h-5" />
					Trimite mesaj
				</button>
			</div>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			<!-- Account Information -->
			<div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
				<div class="flex items-center gap-3 mb-4">
					<div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
						<Info class="w-6 h-6 text-blue-600 dark:text-blue-400" />
					</div>
					<h2 class="text-xl font-semibold text-gray-900 dark:text-slate-100">Informații</h2>
				</div>
				<div class="space-y-4">
					<div>
							<p class="text-sm text-gray-700 dark:text-slate-300 mb-1">Email</p>
						<p class="text-gray-900 dark:text-slate-100 font-medium">{user.email}</p>
					</div>
					<div>
						<p class="text-sm text-gray-600 dark:text-slate-400 mb-1">Rol</p>
						<p class="text-gray-900 dark:text-slate-100 font-medium capitalize">{user.role}</p>
					</div>
					{#if user.specialization}
						<div>
								<p class="text-sm text-gray-700 dark:text-slate-300 mb-1">Specializare</p>
							<p class="text-gray-900 dark:text-slate-100 font-medium">{user.specialization}</p>
						</div>
					{/if}
				</div>
			</div>

			{#if user.role === 'pacient'}
				<!-- Patient Stats Card -->
				<div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
					<div class="flex items-center gap-3 mb-4">
						<div class="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
							<Star class="w-6 h-6 text-purple-600 dark:text-purple-400" />
						</div>
						<h2 class="text-xl font-semibold text-gray-900 dark:text-slate-100">Realizări</h2>
					</div>
					<div class="space-y-4">
						<div class="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
							<div>
								<p class="text-sm text-gray-700 dark:text-slate-300">Zile consecutive</p>
								<p class="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats?.currentStreak ?? 0}</p>
							</div>
							<TrendingUp class="w-8 h-8 text-blue-600 dark:text-blue-400" />
						</div>
						<div class="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
							<div>
								<p class="text-sm text-gray-700 dark:text-slate-300">Record streak</p>
								<p class="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats?.longestStreak ?? 0}</p>
							</div>
							<Award class="w-8 h-8 text-purple-600 dark:text-purple-400" />
						</div>
					</div>
				</div>

				<!-- Badge Display -->
				<div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
					<div class="flex items-center gap-3 mb-4">
						<div class="w-10 h-10 bg-gradient-to-br {getBadgeColor(stats.currentBadge)} rounded-lg flex items-center justify-center">
							<Star class="w-6 h-6 text-white" />
						</div>
						<h2 class="text-xl font-semibold text-gray-900 dark:text-slate-100">Badge curent</h2>
					</div>
					<div class="text-center py-4">
						<div class="w-24 h-24 mx-auto bg-gradient-to-br {getBadgeColor(stats.currentBadge)} rounded-full flex items-center justify-center mb-3 shadow-lg">
							<Star class="w-12 h-12 text-white" fill="currentColor" />
						</div>
						<p class="text-2xl font-bold text-gray-900 dark:text-slate-100">{getBadgeName(stats.currentBadge)}</p>
							<p class="text-gray-700 dark:text-slate-300 mt-1">{stats?.totalXp ?? 0} XP</p>
					</div>
				</div>
			{:else}
				<!-- For Medics/Admins - Professional Info -->
				<div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 md:col-span-2">
					<div class="flex items-center gap-3 mb-4">
						<div class="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
							<CheckCircle2 class="w-6 h-6 text-green-600 dark:text-green-400" />
						</div>
						<h2 class="text-xl font-semibold text-gray-900 dark:text-slate-100">Informații profesionale</h2>
					</div>
					<div class="grid grid-cols-2 gap-4">
						<div class="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
							<p class="text-sm text-gray-600 dark:text-slate-400 mb-1">Specializare</p>
							<p class="text-lg font-semibold text-gray-900 dark:text-slate-100">{user.specialization || 'Generalist'}</p>
						</div>
						<div class="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
							<p class="text-sm text-gray-700 dark:text-slate-300 mb-1">Rol</p>
							<p class="text-lg font-semibold text-gray-900 dark:text-slate-100 capitalize">{user.role}</p>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</main>
