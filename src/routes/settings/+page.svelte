<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore, isPacient } from '$lib/stores/auth';
	import { api, mfaApi } from '$lib/api/client';
	import { loadUserProfile } from '$lib/utils/loaders';
	import { BADGES, getBadgeMeta } from '$lib/constants/badges';
	import { toast } from '$lib/utils/toast';
	import {
		subscribeToPush,
		unsubscribeFromPush,
		isPushSubscribed,
		getNotificationPermission,
		sendTestPushNotification
	} from '$lib/utils/pushNotifications';
	import Modal from '$lib/components/Modal.svelte';

	type TabType = 'general' | 'security' | 'notifications' | 'stats';

	let loading = $state(true);
	let savingProfile = $state(false);
	let savingPassword = $state(false);
	let activeTab = $state<TabType>('general');
	
	let fullName = $state('');
	let email = $state('');
	let avatarUrl = $state('');
	
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let showPasswords = $state(false);
	
	// MFA disable modal state
	let showDisableMfaDialog = $state(false);
	let disableMfaPassword = $state('');

	let mfaStep = $state<'idle' | 'setup' | 'verify' | 'done'>('idle');
	let mfaQr = $state('');
	let mfaSecret = $state('');
	let mfaTotp = $state('');
	let mfaBackupCodes = $state<string[]>([]);
	let mfaWorking = $state(false);
	let mfaError = $state('');
	let copiedCode = $state(false);
	let showRegenerateModal = $state(false);
	let regenerateTotp = $state('');

	// Push notifications state
	let pushSubscribed = $state(false);
	let pushLoading = $state(false);
	let pushPermission = $state<NotificationPermission>('default');
	let testingPush = $state(false);

	async function startMfaSetup() {
		try {
			mfaWorking = true; mfaError = '';
			const data = await mfaApi.startSetup();
			mfaQr = data.qrCode; mfaSecret = data.secret; mfaTotp = '';
			mfaStep = 'verify';
		} catch (e: any) {
			mfaError = e?.message || 'Nu s-a putut iniția 2FA';
		} finally {
			mfaWorking = false;
		}
	}

	async function verifyMfaSetup() {
		try {
			mfaWorking = true; mfaError = '';
			if (!/^\d{6}$/.test(mfaTotp)) { mfaError = 'Cod invalid'; return; }
			const res = await mfaApi.verifySetup(mfaSecret, mfaTotp);
			mfaBackupCodes = res.backupCodes || [];
			mfaStep = 'done';
			try { const updated = await api.getProfile(); /* keep local state in sync */ } catch {}
		} catch (e: any) {
			mfaError = e?.message || 'Cod invalid';
		} finally {
			mfaWorking = false;
		}
	}

	async function disableMfa(password: string) {
		try {
			mfaWorking = true; mfaError = '';
			await mfaApi.disable(password);
			mfaStep = 'idle'; mfaQr = ''; mfaSecret=''; mfaTotp=''; mfaBackupCodes=[];
			showDisableMfaDialog = false;
			disableMfaPassword = '';
			try { const updated = await api.getProfile(); /* keep local state in sync */ } catch {}
		} catch (e: any) {
			mfaError = e?.message || 'Nu s-a putut dezactiva 2FA';
		} finally {
			mfaWorking = false;
		}
	}
	
	function openDisableMfaDialog() {
		showDisableMfaDialog = true;
		disableMfaPassword = '';
		mfaError = '';
	}
	
	function closeDisableMfaDialog() {
		showDisableMfaDialog = false;
		disableMfaPassword = '';
		mfaError = '';
	}
	
	async function confirmDisableMfa() {
		if (!disableMfaPassword.trim()) {
			mfaError = 'Introdu parola';
			return;
		}
		await disableMfa(disableMfaPassword);
	}

	async function regenerateBackupCodes() {
		try {
			mfaWorking = true;
			mfaError = '';
			// Open inline modal for TOTP entry instead of separate modal
			showRegenerateModal = true;
			regenerateTotp = '';
		} catch (e: any) {
			mfaError = e?.message || 'Nu s-au putut regenera codurile';
		} finally {
			mfaWorking = false;
		}
	}

	async function confirmRegenerateBackupCodes() {
		try {
			mfaWorking = true; 
			mfaError = '';
			if (!/^\d{6}$/.test(regenerateTotp)) { throw new Error('Cod TOTP invalid'); }
			const res = await mfaApi.generateBackupCodes(regenerateTotp);
			mfaBackupCodes = res.backupCodes || [];
			showRegenerateModal = false;
			regenerateTotp = '';
		} catch (e: any) {
			mfaError = e?.message || 'Nu s-au putut regenera codurile';
		} finally {
			mfaWorking = false;
		}
	}

	function copyAllBackupCodes() {
		if (mfaBackupCodes.length === 0) return;
		const text = mfaBackupCodes.join('\n');
		navigator.clipboard.writeText(text).then(() => {
			copiedCode = true;
			setTimeout(() => copiedCode = false, 2000);
		}).catch(() => {
			mfaError = 'Nu s-au putut copia codurile';
		});
	}

	function downloadBackupCodes() {
		if (mfaBackupCodes.length === 0) return;
		const text = `MediTrack - Coduri de backup 2FA\n\nGenerate la: ${new Date().toLocaleString('ro-RO')}\n\n${mfaBackupCodes.join('\n')}\n\nNotă: Păstrează aceste coduri într-un loc sigur. Fiecare cod poate fi folosit o singură dată.`;
		const blob = new Blob([text], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `meditrack-backup-codes-${Date.now()}.txt`;
		a.click();
		URL.revokeObjectURL(url);
	}
	
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
		{ id: 'notifications' as TabType, name: 'Notificări', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
		{ id: 'stats' as TabType, name: 'Statistici', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', show: $isPacient }
	];

	onMount(async () => {
		try {
			if (!$authStore.token) {
				window.location.href = '/';
				return;
			}
			await loadProfile();
			await checkPushStatus();
		} catch (error) {
			console.error('Settings initialization error:', error);
		} finally {
			loading = false;
		}
	});

	async function checkPushStatus() {
		try {
			pushPermission = getNotificationPermission();
			pushSubscribed = await isPushSubscribed();
		} catch (error) {
			console.error('Failed to check push status:', error);
			pushPermission = 'default';
			pushSubscribed = false;
		}
	}

	async function loadProfile() {
		try {
			const profile = await loadUserProfile();
			const user = profile.user;
			fullName = user.fullName || '';
			email = user.email || '';
			avatarUrl = user.avatarUrl || '';

			mfaStep = user.mfaEnabled ? 'done' : 'idle';
			if ($isPacient) {
				stats = profile.stats;
			}
		} catch (error) {
			console.error('Failed to load profile:', error);
			fullName = $authStore.user?.fullName || 'User';
			email = $authStore.user?.email || '';
			avatarUrl = '';
		}
	}

	async function handleSaveProfile() {
		if (!fullName.trim()) {
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
		} catch (error: any) {
			toast.error(error.message || 'Nu s-au putut salva modificările');
		} finally {
			savingProfile = false;
		}
	}

	async function handleChangePassword() {
		if (!currentPassword || !newPassword || !confirmPassword) {
			toast.warning('Toate câmpurile sunt obligatorii');
			return;
		}

		if (newPassword !== confirmPassword) {
			toast.warning('Parolele noi nu coincid');
			return;
		}

		if (newPassword.length < 6) {
			toast.warning('Parola nouă trebuie să aibă cel puțin 6 caractere');
			return;
		}
		
		// Direct password change without confirmation dialog
		await confirmPasswordChange();
	}
	
	async function confirmPasswordChange() {
		savingPassword = true;
		
		try {
			await api.updatePassword({
				currentPassword,
				newPassword
			});
			
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
		toast.success('Parola a fost schimbată cu succes');
	} catch (error: any) {
		toast.error(error.message || 'Nu s-a putut schimba parola');
		} finally {
			savingPassword = false;
		}
	}

	function getBadgeColor(badge: string) {
		return getBadgeMeta(badge).gradient;
	}

	function getBadgeName(badge: string) {
		return getBadgeMeta(badge).name;
	}

	async function handleTogglePushNotifications() {
		if (pushLoading) return;

		try {
			pushLoading = true;

			if (pushSubscribed) {
				// Unsubscribe
				await unsubscribeFromPush();
				pushSubscribed = false;
				toast.success('Notificările push au fost dezactivate');
			} else {
				// Subscribe
				await subscribeToPush();
				pushSubscribed = true;
				pushPermission = getNotificationPermission();
				toast.success('Notificările push au fost activate!');
			}
		} catch (error: any) {
			console.error('Toggle push error:', error);
			toast.error(error.message || 'Eroare la configurarea notificărilor');
		} finally {
			pushLoading = false;
		}
	}

	async function handleTestPushNotification() {
		if (testingPush) return;

		try {
			testingPush = true;
			const result = await sendTestPushNotification();
			
			if (result.success && result.sent > 0) {
				toast.success(`Notificare trimisă! (${result.sent}/${result.total})`);
			} else {
				toast.warning('Nu s-au putut trimite notificări. Verifică dacă ești abonat.');
			}
		} catch (error: any) {
			console.error('Test push error:', error);
			toast.error(error.message || 'Eroare la trimiterea notificării de test');
		} finally {
			testingPush = false;
		}
	}
</script>

<main class="page-transition max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	{#if loading}
		<div class="flex items-center justify-center min-h-[400px]">
			<div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
		</div>
	{:else}
		<div class="mb-8">
			<div class="flex items-center gap-4">
				<div class="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
					{#if avatarUrl}
						<img src={avatarUrl} alt={fullName} class="w-full h-full rounded-full object-cover" />
					{:else}
						<span class="text-white text-3xl font-bold">{fullName ? fullName.charAt(0).toUpperCase() : 'U'}</span>
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

		<div class="flex flex-col md:flex-row gap-6">
			<div class="md:w-64 flex-shrink-0">
				<nav class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-2 space-y-1">
					{#each tabs as tab}
						{#if tab.show !== false}
							<button
								onclick={() => activeTab = tab.id}
								class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-md {activeTab === tab.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium scale-105 shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}"
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

			<div class="flex-1 min-w-0">
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
									class="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 hover:shadow-xl hover:shadow-purple-500/50 hover:scale-105 active:scale-95 disabled:bg-gray-400 disabled:hover:scale-100 disabled:hover:shadow-none text-white rounded-lg transition-all duration-300 ease-in-out flex items-center gap-2"
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

					<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mt-6">
						<div class="flex items-center gap-3 mb-6">
							<div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
								<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
								</svg>
							</div>
							<div>
								<h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Autentificare în doi pași (2FA)</h3>
								<p class="text-sm text-gray-500 dark:text-gray-400">Protecție suplimentară pentru contul tău</p>
							</div>
						</div>

						{#if mfaStep === 'idle'}
							<div class="space-y-4">
								<div class="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
									<svg class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
									</svg>
									<div class="text-sm text-blue-900 dark:text-blue-100">
										<p class="font-medium mb-1">De ce să activezi 2FA?</p>
										<p class="text-blue-700 dark:text-blue-300">Protejează-ți contul cu un cod generat de o aplicație de autentificare (Google Authenticator, Authy, Microsoft Authenticator).</p>
									</div>
								</div>
								<button 
									class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 text-white rounded-lg transition-all duration-200 flex items-center gap-2" 
									disabled={mfaWorking} 
									onclick={startMfaSetup}
								>
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
									</svg>
									Activează 2FA
								</button>
							</div>
						{/if}

						{#if mfaStep === 'verify'}
							<div class="space-y-5">
								<div class="flex flex-col items-center p-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
									<p class="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">Scanează acest cod QR în aplicația ta de autentificare</p>
									<div class="bg-white p-4 rounded-lg shadow-md">
										<img src={mfaQr} alt="QR Code 2FA" class="w-48 h-48" />
									</div>
									<p class="text-xs text-gray-500 dark:text-gray-500 mt-3 text-center">Google Authenticator · Authy · Microsoft Authenticator</p>
								</div>
								<div>
									<label for="mfaTotp" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
										Introdu codul de verificare (6 cifre)
									</label>
									<div class="relative">
										<input 
											id="mfaTotp" 
											type="text"
											class="w-full px-4 py-3 text-lg tracking-widest text-center border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono" 
											bind:value={mfaTotp} 
											maxlength={6} 
											placeholder="000000"
											autocomplete="off"
											oninput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, ''); }}
										/>
										{#if mfaTotp.length === 6}
											<div class="absolute right-3 top-1/2 -translate-y-1/2">
												<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
												</svg>
											</div>
										{/if}
									</div>
									<div class="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
										</svg>
										<span>Codul se actualizează la fiecare 30 de secunde</span>
									</div>
								</div>
								{#if mfaError}
									<div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-shake">
										<svg class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
										</svg>
										<p class="text-sm text-red-700 dark:text-red-300">{mfaError}</p>
									</div>
								{/if}
								<div class="flex gap-3">
									<button 
										class="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 hover:shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium" 
										disabled={mfaWorking || mfaTotp.length!==6} 
										onclick={verifyMfaSetup}
									>
										{#if mfaWorking}
											<svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
												<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
												<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
											</svg>
											Se verifică...
										{:else}
											<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
											</svg>
											Verifică și activează
										{/if}
									</button>
									<button 
										class="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-all font-medium"
										onclick={() => { mfaStep = 'idle'; mfaQr = ''; mfaSecret = ''; mfaTotp = ''; mfaError = ''; }}
									>
										Anulează
									</button>
								</div>
							</div>
						{/if}

						{#if mfaStep === 'done'}
							<div class="space-y-5">
								<div class="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
									<svg class="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
									</svg>
									<div>
										<p class="font-medium text-green-900 dark:text-green-100">Autentificarea în doi pași este activată</p>
										<p class="text-sm text-green-700 dark:text-green-300 mt-1">Contul tău este acum mai bine protejat.</p>
									</div>
								</div>

								{#if mfaBackupCodes.length > 0}
									<div class="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
										<div class="flex items-start gap-3 mb-3">
											<svg class="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
											</svg>
											<div class="flex-1">
												<p class="font-medium text-amber-900 dark:text-amber-100 mb-1">Coduri de backup</p>
												<p class="text-sm text-amber-700 dark:text-amber-300 mb-3">Salvează aceste coduri într-un loc sigur. Poți folosi fiecare o singură dată dacă pierzi accesul la aplicația de autentificare.</p>
												<div class="bg-white dark:bg-gray-900 p-4 rounded-lg border border-amber-300 dark:border-amber-700 font-mono text-sm space-y-1.5">
													{#each mfaBackupCodes as code}
														<div class="text-gray-900 dark:text-gray-100 py-1">{code}</div>
													{/each}
												</div>
												<div class="flex gap-2 mt-4">
													<button 
														class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium hover:shadow-lg hover:scale-105 active:scale-95"
														onclick={copyAllBackupCodes}
														disabled={copiedCode}
													>
														{#if copiedCode}
															<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
															</svg>
															Copiat!
														{:else}
															<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
															</svg>
															Copiază toate
														{/if}
													</button>
													<button 
														class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium hover:shadow-lg hover:scale-105 active:scale-95"
														onclick={downloadBackupCodes}
													>
														<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
														</svg>
														Descarcă .txt
													</button>
												</div>
											</div>
										</div>
									</div>
								{/if}

								<div class="flex flex-wrap gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
									<button 
										class="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 hover:shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 text-white rounded-lg transition-all duration-200 flex items-center gap-2 font-medium" 
										onclick={regenerateBackupCodes} 
										disabled={mfaWorking}
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
										</svg>
										Generează coduri noi
									</button>
									<button 
										class="px-5 py-2.5 bg-red-600 hover:bg-red-700 hover:shadow-lg hover:scale-105 active:scale-95 text-white rounded-lg transition-all duration-200 flex items-center gap-2 font-medium" 
										onclick={openDisableMfaDialog}
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
										</svg>
										Dezactivează 2FA
									</button>
								</div>
							</div>
						{/if}
					</div>
				{/if}

				{#if activeTab === 'notifications'}
					<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
						<h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Setări notificări</h2>

						<!-- Push Notifications Section -->
						<div class="space-y-6">
							<div class="flex items-center gap-3 mb-4">
								<div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
									<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
									</svg>
								</div>
								<div>
									<h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Notificări Push</h3>
									<p class="text-sm text-gray-500 dark:text-gray-400">Primește notificări pentru medicamente și mesaje</p>
								</div>
							</div>

							<!-- Permission Status -->
							<div class="p-4 rounded-lg border {pushPermission === 'granted' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : pushPermission === 'denied' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'}">
								<div class="flex items-start gap-3">
									{#if pushPermission === 'granted'}
										<svg class="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
										</svg>
										<div>
											<p class="font-medium text-green-900 dark:text-green-100">Permisiuni acordate</p>
											<p class="text-sm text-green-700 dark:text-green-300 mt-1">Browser-ul tău poate trimite notificări push</p>
										</div>
									{:else if pushPermission === 'denied'}
										<svg class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
										</svg>
										<div>
											<p class="font-medium text-red-900 dark:text-red-100">Permisiuni refuzate</p>
											<p class="text-sm text-red-700 dark:text-red-300 mt-1">Activează notificările în setările browser-ului</p>
										</div>
									{:else}
										<svg class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
										</svg>
										<div>
											<p class="font-medium text-blue-900 dark:text-blue-100">Permisiuni necesare</p>
											<p class="text-sm text-blue-700 dark:text-blue-300 mt-1">Activează notificările pentru a primi alerte</p>
										</div>
									{/if}
								</div>
							</div>

							<!-- Subscription Toggle -->
							<div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
								<div class="flex-1">
									<h4 class="font-medium text-gray-900 dark:text-gray-100">Notificări Push Active</h4>
									<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
										{#if pushSubscribed}
											Vei primi notificări pentru medicamente și mesaje
										{:else}
											Activează pentru a primi notificări în timp real
										{/if}
									</p>
								</div>
								<button
									onclick={handleTogglePushNotifications}
									disabled={pushLoading || pushPermission === 'denied'}
									aria-label={pushSubscribed ? 'Dezactivează notificările push' : 'Activează notificările push'}
									class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed {pushSubscribed ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}"
								>
									<span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {pushSubscribed ? 'translate-x-5' : 'translate-x-0'}"></span>
								</button>
							</div>

							<!-- Test Notification (Admin Only) -->
							{#if $authStore.user?.role === 'admin'}
								<div class="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
									<div class="flex items-start gap-3">
										<svg class="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
										</svg>
										<div class="flex-1">
											<p class="font-medium text-purple-900 dark:text-purple-100 mb-1">Test Notificare (Admin)</p>
											<p class="text-sm text-purple-700 dark:text-purple-300 mb-3">Trimite o notificare de test pentru a verifica configurarea</p>
											<button
												onclick={handleTestPushNotification}
												disabled={testingPush || !pushSubscribed}
												class="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium hover:shadow-lg hover:scale-105 active:scale-95"
											>
												{#if testingPush}
													<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
														<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
														<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
													</svg>
													Se trimite...
												{:else}
													<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
													</svg>
													Trimite notificare test
												{/if}
											</button>
										</div>
									</div>
								</div>
							{/if}

							<!-- Info Card -->
							<div class="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
								<div class="flex items-start gap-3">
									<svg class="w-5 h-5 text-gray-600 dark:text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
									</svg>
									<div class="text-sm text-gray-600 dark:text-gray-400">
										<p class="font-medium mb-1">Despre notificările push</p>
										<ul class="list-disc list-inside space-y-1">
											<li>Primești alerte instant pentru medicamente</li>
											<li>Notificări pentru mesaje noi de la medic</li>
											<li>Funcționează chiar dacă aplicația este închisă</li>
											<li>Poți dezactiva oricând din acest meniu</li>
										</ul>
									</div>
								</div>
							</div>
						</div>
					</div>
				{/if}

				{#if activeTab === 'stats' && $isPacient}
					<div class="space-y-6">
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

						<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
							<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Progresie badge-uri</h3>
							<div class="space-y-4">
								{#each BADGES as badge}
									<div class="flex items-center gap-4">
										<div class="w-12 h-12 bg-gradient-to-br {badge.gradient} rounded-full flex items-center justify-center flex-shrink-0">
											<svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
												<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
											</svg>
										</div>
										<div class="flex-1">
											<p class="font-medium text-gray-900 dark:text-gray-100">{badge.name}</p>
											<p class="text-sm text-gray-600 dark:text-gray-400">{badge.xp} XP necesar</p>
										</div>
										{#if stats.currentBadge === badge.id}
											<span class="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium rounded-full">Curent</span>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</main>

<!-- Regenerate Backup Codes Modal -->
<Modal
	isOpen={showRegenerateModal}
	title="Generează coduri noi"
	type="warning"
	size="md"
	showCancel={true}
	confirmText={mfaWorking ? 'Procesează...' : 'Generează'}
	cancelText="Anulează"
	isLoading={mfaWorking}
	onConfirm={confirmRegenerateBackupCodes}
	onCancel={() => { showRegenerateModal = false; regenerateTotp = ''; mfaError = ''; }}
	onClose={() => { showRegenerateModal = false; regenerateTotp = ''; mfaError = ''; }}
>
	<div class="space-y-4">
		<p class="text-sm text-gray-600 dark:text-gray-400">
			Codurile vechi vor fi invalidate. Introdu un cod TOTP pentru confirmare.
		</p>
		<div>
			<label for="regenerateTotp" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
				Cod autentificator (6 cifre)
			</label>
			<input 
				id="regenerateTotp" 
				type="text"
				class="w-full px-4 py-2.5 text-lg tracking-widest text-center border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all font-mono" 
				bind:value={regenerateTotp} 
				maxlength={6} 
				placeholder="000000"
				autocomplete="off"
				oninput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, ''); }}
			/>
		</div>
		{#if mfaError}
			<div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
				<svg class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
				</svg>
				<p class="text-sm text-red-700 dark:text-red-300">{mfaError}</p>
			</div>
		{/if}
	</div>
</Modal>

<!-- Disable MFA Modal -->
<Modal
	isOpen={showDisableMfaDialog}
	title="Dezactivează 2FA"
	type="error"
	size="md"
	showCancel={true}
	confirmText={mfaWorking ? 'Procesează...' : 'Dezactivează 2FA'}
	cancelText="Anulează"
	isLoading={mfaWorking}
	onConfirm={confirmDisableMfa}
	onCancel={closeDisableMfaDialog}
	onClose={closeDisableMfaDialog}
>
	<div class="space-y-4">
		<p class="text-sm text-gray-600 dark:text-gray-400">
			Autentificarea cu doi factori va fi dezactivată complet. Introdu parola pentru confirmare.
		</p>
		<div>
			<label for="disableMfaPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
				Parola ta
			</label>
			<input 
				id="disableMfaPassword" 
				type="password"
				class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all" 
				bind:value={disableMfaPassword} 
				placeholder="Introdu parola"
				autocomplete="current-password"
			/>
		</div>
		{#if mfaError}
			<div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
				<svg class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
				</svg>
				<p class="text-sm text-red-700 dark:text-red-300">{mfaError}</p>
			</div>
		{/if}
	</div>
</Modal>