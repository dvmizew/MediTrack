<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore, isPacient, isMedic } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/notifications';

	type TabType = 'general' | 'security' | 'stats' | 'notifications' | 'privacy';

	let loading = $state(true);
	let savingProfile = $state(false);
	let savingPassword = $state(false);
	let activeTab = $state<TabType>('general');
	
	// Profile form
	let fullName = $state('');
	let email = $state('');
	let avatarUrl = $state('');
	
	// Password form
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let showPasswords = $state(false);
	
	// Notification preferences
	let emailNotifications = $state(true);
	let pushNotifications = $state(true);
	let reminderNotifications = $state(true);
	let treatmentUpdates = $state(true);
	let savingNotifications = $state(false);
	
	// Privacy settings
	let profileVisibility = $state<'public' | 'private'>('private');
	let shareStatistics = $state(false);
	let savingPrivacy = $state(false);
	
	// Stats (for patients)
	let stats = $state({
		totalXp: 0,
		currentStreak: 0,
		longestStreak: 0,
		currentBadge: 'bronze',
		adherenceRate: 0,
		totalMedications: 0,
		completedTreatments: 0,
		activeTreatments: 0
	});

	const tabs = [
		{ id: 'general' as TabType, name: 'General', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
		{ id: 'security' as TabType, name: 'Securitate', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
		{ id: 'stats' as TabType, name: 'Statistici', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', show: $isPacient },
		{ id: 'notifications' as TabType, name: 'Notificări', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
		{ id: 'privacy' as TabType, name: 'Confidențialitate', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' }
	];

	onMount(async () => {
		await loadProfile();
		if ($isPacient) {
			await loadStats();
		}
		loading = false;
	});

	async function loadProfile() {
		try {
			const user = await api.getProfile();
			fullName = user.fullName || '';
			email = user.email || '';
			avatarUrl = user.avatarUrl || '';
		} catch (error) {
			console.error('Failed to load profile:', error);
			toastStore.add({
				type: 'error',
				title: 'Eroare',
				message: 'Nu s-a putut încărca profilul',
				duration: 3000
			});
		}
	}

	async function loadStats() {
		try {
			const user = await api.getProfile();
			stats = {
				totalXp: user.totalXp || 0,
				currentStreak: user.currentStreak || 0,
				longestStreak: user.longestStreak || 0,
				currentBadge: user.currentBadge || 'bronze',
				adherenceRate: 0,
				totalMedications: 0,
				completedTreatments: 0,
				activeTreatments: 0
			};
		} catch (error) {
			console.error('Failed to load stats:', error);
		}
	}

	async function handleSaveProfile() {
		if (!fullName.trim()) {
			toastStore.add({
				type: 'error',
				title: 'Eroare',
				message: 'Numele este obligatoriu',
				duration: 3000
			});
			return;
		}

		savingProfile = true;
		try {
			await api.updateProfile({
				fullName: fullName.trim(),
				email: email.trim(),
				avatarUrl: avatarUrl.trim()
			});
			
			const updatedUser = await api.getProfile();
			authStore.updateUser(updatedUser);
			
			toastStore.add({
				type: 'success',
				title: 'Succes',
				message: 'Profilul a fost actualizat',
				duration: 3000
			});
		} catch (error: any) {
			toastStore.add({
				type: 'error',
				title: 'Eroare',
				message: error.message || 'Nu s-a putut actualiza profilul',
				duration: 3000
			});
		} finally {
			savingProfile = false;
		}
	}

	async function handleChangePassword() {
		if (!currentPassword || !newPassword || !confirmPassword) {
			toastStore.add({
				type: 'error',
				title: 'Eroare',
				message: 'Toate câmpurile sunt obligatorii',
				duration: 3000
			});
			return;
		}

		if (newPassword !== confirmPassword) {
			toastStore.add({
				type: 'error',
				title: 'Eroare',
				message: 'Parolele nu coincid',
				duration: 3000
			});
			return;
		}

		if (newPassword.length < 6) {
			toastStore.add({
				type: 'error',
				title: 'Eroare',
				message: 'Parola trebuie să aibă minim 6 caractere',
				duration: 3000
			});
			return;
		}

		savingPassword = true;
		try {
			await api.updatePassword({
				currentPassword,
				newPassword
			});
			
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
			
			toastStore.add({
				type: 'success',
				title: 'Succes',
				message: 'Parola a fost schimbată',
				duration: 3000
			});
		} catch (error: any) {
			toastStore.add({
				type: 'error',
				title: 'Eroare',
				message: error.message || 'Nu s-a putut schimba parola',
				duration: 3000
			});
		} finally {
			savingPassword = false;
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

	async function handleSaveNotifications() {
		savingNotifications = true;
		try {
			// API call would go here
			await new Promise(resolve => setTimeout(resolve, 500));
			toastStore.add({
				type: 'success',
				title: 'Succes',
				message: 'Preferințele de notificare au fost actualizate',
				duration: 3000
			});
		} catch (error: any) {
			toastStore.add({
				type: 'error',
				title: 'Eroare',
				message: error.message || 'Nu s-au putut salva preferințele',
				duration: 3000
			});
		} finally {
			savingNotifications = false;
		}
	}

	async function handleSavePrivacy() {
		savingPrivacy = true;
		try {
			// API call would go here
			await new Promise(resolve => setTimeout(resolve, 500));
			toastStore.add({
				type: 'success',
				title: 'Succes',
				message: 'Setările de confidențialitate au fost actualizate',
				duration: 3000
			});
		} catch (error: any) {
			toastStore.add({
				type: 'error',
				title: 'Eroare',
				message: error.message || 'Nu s-au putut salva setările',
				duration: 3000
			});
		} finally {
			savingPrivacy = false;
		}
	}
</script>

<main class="page-transition max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	{#if loading}
		<div class="flex items-center justify-center min-h-[400px]">
			<div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
		</div>
	{:else}
		<!-- Header -->
		<div class="mb-8">
			<div class="flex items-center gap-4">
				<div class="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
					{#if avatarUrl}
						<img src={avatarUrl} alt={fullName} class="w-full h-full rounded-full object-cover" />
					{:else}
						<span class="text-white text-3xl font-bold">{fullName.charAt(0).toUpperCase()}</span>
					{/if}
				</div>
				<div>
					<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">{fullName}</h1>
					<p class="text-gray-600 dark:text-gray-400 capitalize">{$authStore.user?.role}</p>
					{#if $isPacient}
						<p class="text-sm text-blue-600 dark:text-blue-400 mt-1">{stats.totalXp} XP · {getBadgeName(stats.currentBadge)}</p>
					{/if}
				</div>
			</div>
		</div>

		<!-- Tabs Layout -->
		<div class="flex flex-col md:flex-row gap-6">
			<!-- Vertical Tabs - Left Sidebar -->
			<div class="md:w-64 flex-shrink-0">
				<nav class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-2 space-y-1">
					{#each tabs as tab}
						{#if tab.show !== false}
							<button
								onclick={() => activeTab = tab.id}
								class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 {activeTab === tab.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}"
							>
								<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={tab.icon}/>
								</svg>
								<span class="truncate">{tab.name}</span>
							</button>
						{/if}
					{/each}
				</nav>
			</div>

			<!-- Content Area -->
			<div class="flex-1 min-w-0">
				<!-- General Tab -->
				{#if activeTab === 'general'}
					<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
						<h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Informații generale</h2>
						<form onsubmit={(e) => { e.preventDefault(); handleSaveProfile(); }} class="space-y-6">
							<div>
								<label for="fullName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Nume complet
								</label>
								<input
									type="text"
									id="fullName"
									bind:value={fullName}
									class="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
									placeholder="Numele tău complet"
									required
								/>
							</div>

							<div>
								<label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Email
								</label>
								<input
									type="email"
									id="email"
									bind:value={email}
									class="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
									placeholder="email@example.com"
									required
								/>
							</div>

							<div>
								<label for="avatarUrl" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									URL avatar (opțional)
								</label>
								<input
									type="url"
									id="avatarUrl"
									bind:value={avatarUrl}
									class="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
									placeholder="https://example.com/avatar.jpg"
								/>
								{#if avatarUrl}
									<div class="mt-3 flex items-center gap-3">
										<img src={avatarUrl} alt="Preview" class="w-12 h-12 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600" />
										<span class="text-sm text-gray-600 dark:text-gray-400">Previzualizare avatar</span>
									</div>
								{/if}
							</div>

							<div class="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
								<button
									type="submit"
									disabled={savingProfile}
									class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
								>
									{#if savingProfile}
										<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
										</svg>
										Se salvează...
									{:else}
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
										</svg>
										Salvează modificările
									{/if}
								</button>
							</div>
						</form>
					</div>
				{/if}

				<!-- Security Tab -->
				{#if activeTab === 'security'}
					<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
						<h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Securitate</h2>
						<form onsubmit={(e) => { e.preventDefault(); handleChangePassword(); }} class="space-y-6">
							<div>
								<label for="currentPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Parola curentă
								</label>
								<input
									type={showPasswords ? 'text' : 'password'}
									id="currentPassword"
									bind:value={currentPassword}
									class="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
									placeholder="••••••••"
									required
								/>
							</div>

							<div>
								<label for="newPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Parola nouă
								</label>
								<input
									type={showPasswords ? 'text' : 'password'}
									id="newPassword"
									bind:value={newPassword}
									class="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
									placeholder="••••••••"
									required
								/>
							</div>

							<div>
								<label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Confirmă parola nouă
								</label>
								<input
									type={showPasswords ? 'text' : 'password'}
									id="confirmPassword"
									bind:value={confirmPassword}
									class="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
									placeholder="••••••••"
									required
								/>
							</div>

							<div class="flex items-center">
								<input
									type="checkbox"
									id="showPasswords"
									bind:checked={showPasswords}
									class="w-4 h-4 text-blue-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
								/>
								<label for="showPasswords" class="ml-2 text-sm text-gray-700 dark:text-gray-300">
									Arată parolele
								</label>
							</div>

							<div class="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
								<button
									type="submit"
									disabled={savingPassword}
									class="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
								>
									{#if savingPassword}
										<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
										</svg>
										Se schimbă...
									{:else}
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
										</svg>
										Schimbă parola
									{/if}
								</button>
							</div>
						</form>
					</div>
				{/if}

				<!-- Stats Tab (Patients Only) -->
				{#if activeTab === 'stats' && $isPacient}
					<div class="space-y-6">
						<!-- Badge Card -->
						<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
							<h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Statistici și realizări</h2>
							
							<div class="flex flex-col items-center mb-8">
								<div class="w-32 h-32 bg-gradient-to-br {getBadgeColor(stats.currentBadge)} rounded-full flex items-center justify-center mb-4 shadow-lg">
									<svg class="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
										<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
									</svg>
								</div>
								<h3 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{getBadgeName(stats.currentBadge)}</h3>
								<p class="text-lg text-gray-600 dark:text-gray-400">{stats.totalXp} XP</p>
							</div>

							<!-- Stats Grid -->
							<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
								<div class="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
									<p class="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.currentStreak}</p>
									<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Zile consecutive</p>
								</div>
								<div class="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
									<p class="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.longestStreak}</p>
									<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Record</p>
								</div>
								<div class="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
									<p class="text-3xl font-bold text-green-600 dark:text-green-400">{stats.completedTreatments}</p>
									<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Tratamente finalizate</p>
								</div>
								<div class="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
									<p class="text-3xl font-bold text-orange-600 dark:text-orange-400">{stats.activeTreatments}</p>
									<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Tratamente active</p>
								</div>
							</div>
						</div>

						<!-- Progress Info -->
						<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
							<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Progresie badge-uri</h3>
							<div class="space-y-4">
								{#each ['bronze', 'silver', 'gold', 'platinum', 'diamond'] as badge, i}
									<div class="flex items-center gap-4">
										<div class="w-12 h-12 bg-gradient-to-br {getBadgeColor(badge)} rounded-full flex items-center justify-center flex-shrink-0">
											<svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
												<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
											</svg>
										</div>
										<div class="flex-1">
											<p class="font-medium text-gray-900 dark:text-gray-100">{getBadgeName(badge)}</p>
											<p class="text-sm text-gray-600 dark:text-gray-400">{i * 1000} XP necesar</p>
										</div>
										{#if stats.currentBadge === badge}
											<span class="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium rounded-full">Curent</span>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					</div>
				{/if}

				<!-- Notifications Tab -->
				{#if activeTab === 'notifications'}
					<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
						<h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Preferințe notificări</h2>
						<form onsubmit={(e) => { e.preventDefault(); handleSaveNotifications(); }} class="space-y-6">
							<div class="space-y-4">
								<div class="flex items-start">
									<div class="flex items-center h-5">
										<input
											type="checkbox"
											id="emailNotifications"
											bind:checked={emailNotifications}
											class="w-4 h-4 text-blue-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
										/>
									</div>
									<div class="ml-3">
										<label for="emailNotifications" class="font-medium text-gray-900 dark:text-gray-100">
											Notificări email
										</label>
										<p class="text-sm text-gray-600 dark:text-gray-400">Primește notificări importante pe email</p>
									</div>
								</div>

								<div class="flex items-start">
									<div class="flex items-center h-5">
										<input
											type="checkbox"
											id="pushNotifications"
											bind:checked={pushNotifications}
											class="w-4 h-4 text-blue-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
										/>
									</div>
									<div class="ml-3">
										<label for="pushNotifications" class="font-medium text-gray-900 dark:text-gray-100">
											Notificări push
										</label>
										<p class="text-sm text-gray-600 dark:text-gray-400">Notificări în browser când aplicația este deschisă</p>
									</div>
								</div>

								<div class="flex items-start">
									<div class="flex items-center h-5">
										<input
											type="checkbox"
											id="reminderNotifications"
											bind:checked={reminderNotifications}
											class="w-4 h-4 text-blue-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
										/>
									</div>
									<div class="ml-3">
										<label for="reminderNotifications" class="font-medium text-gray-900 dark:text-gray-100">
											Mementouri medicamente
										</label>
										<p class="text-sm text-gray-600 dark:text-gray-400">Primește reminder-uri pentru medicamente</p>
									</div>
								</div>

								<div class="flex items-start">
									<div class="flex items-center h-5">
										<input
											type="checkbox"
											id="treatmentUpdates"
											bind:checked={treatmentUpdates}
											class="w-4 h-4 text-blue-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
										/>
									</div>
									<div class="ml-3">
										<label for="treatmentUpdates" class="font-medium text-gray-900 dark:text-gray-100">
											Actualizări tratamente
										</label>
										<p class="text-sm text-gray-600 dark:text-gray-400">Notificări când medicul actualizează tratamentul</p>
									</div>
								</div>
							</div>

							<div class="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
								<button
									type="submit"
									disabled={savingNotifications}
									class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
								>
									{#if savingNotifications}
										<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
										</svg>
										Se salvează...
									{:else}
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
										</svg>
										Salvează preferințele
									{/if}
								</button>
							</div>
						</form>
					</div>
				{/if}

				<!-- Privacy Tab -->
				{#if activeTab === 'privacy'}
					<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
						<h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Confidențialitate</h2>
						<form onsubmit={(e) => { e.preventDefault(); handleSavePrivacy(); }} class="space-y-6">
							<div>
								<p class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
									Vizibilitate profil
								</p>
								<div class="space-y-3">
									<div class="flex items-center">
										<input
											type="radio"
											id="profilePrivate"
											name="profileVisibility"
											value="private"
											bind:group={profileVisibility}
											class="w-4 h-4 text-blue-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
										/>
										<label for="profilePrivate" class="ml-3">
											<span class="font-medium text-gray-900 dark:text-gray-100">Privat</span>
											<p class="text-sm text-gray-600 dark:text-gray-400">Doar medicii cu care colaborezi pot vedea profilul</p>
										</label>
									</div>
									<div class="flex items-center">
										<input
											type="radio"
											id="profilePublic"
											name="profileVisibility"
											value="public"
											bind:group={profileVisibility}
											class="w-4 h-4 text-blue-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
										/>
										<label for="profilePublic" class="ml-3">
											<span class="font-medium text-gray-900 dark:text-gray-100">Public</span>
											<p class="text-sm text-gray-600 dark:text-gray-400">Profilul poate fi vizualizat de toți utilizatorii</p>
										</label>
									</div>
								</div>
							</div>

							<div class="pt-4 border-t border-gray-200 dark:border-gray-700">
								<div class="flex items-start">
									<div class="flex items-center h-5">
										<input
											type="checkbox"
											id="shareStatistics"
											bind:checked={shareStatistics}
											class="w-4 h-4 text-blue-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
										/>
									</div>
									<div class="ml-3">
										<label for="shareStatistics" class="font-medium text-gray-900 dark:text-gray-100">
											Partajează statisticile
										</label>
										<p class="text-sm text-gray-600 dark:text-gray-400">Permite medicilor să vadă statisticile tale de aderență</p>
									</div>
								</div>
							</div>

							<div class="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
								<button
									type="submit"
									disabled={savingPrivacy}
									class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
								>
									{#if savingPrivacy}
										<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
										</svg>
										Se salvează...
									{:else}
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
										</svg>
										Salvează setările
									{/if}
								</button>
							</div>
						</form>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</main>
