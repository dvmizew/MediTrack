<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore, isPacient } from '$lib/stores/auth';
	import { api, mfaApi } from '$lib/api/client';
	import { loadUserProfile } from '$lib/utils/loaders';
	import { BADGES, getBadgeMeta } from '$lib/constants/badges';
	import { toast } from '$lib/utils/toast';
	import { User, Lock, Bell, BarChart3, Loader, CheckCircle2, Info, AlertTriangle, Trash2, Star, X, XCircle, Copy, Download, RotateCcw, Shield, Key, Zap, Cookie } from '@lucide/svelte';
	import {
		subscribeToPush,
		unsubscribeFromPush,
		isPushSubscribed,
		getNotificationPermission,
		sendTestPushNotification
	} from '$lib/utils/pushNotifications';
	import Modal from '$lib/components/Modal.svelte';

	type TabType = 'general' | 'security' | 'notifications' | 'stats' | 'privacy';

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

	// GDPR state
	let showDeleteAccountDialog = $state(false);
	let deleteAccountPassword = $state('');
	let deletingAccount = $state(false);
	let deleteAccountError = $state('');
	let downloadingData = $state(false);

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
		{ id: 'general' as TabType, name: 'General', icon: User },
		{ id: 'security' as TabType, name: 'Securitate', icon: Lock },
		{ id: 'notifications' as TabType, name: 'Notificări', icon: Bell },
		{ id: 'stats' as TabType, name: 'Statistici', icon: BarChart3, show: $isPacient },
		{ id: 'privacy' as TabType, name: 'Confidențialitate', icon: Shield }
	];

	function getTabIcon(tabId: TabType) {
		const iconMap: Record<TabType, any> = {
			general: User,
			security: Lock,
			notifications: Bell,
			stats: BarChart3,
			privacy: Shield
		};
		return iconMap[tabId];
	}

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

	async function handleDownloadPersonalData() {
		if (downloadingData) return;

		try {
			downloadingData = true;
			const response = await fetch('/api/admin/reports/export/personal-data', {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${$authStore.token}`
				}
			});

			if (!response.ok) {
				throw new Error('Nu s-au putut descărca datele');
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `meditrack_date_personale_${new Date().toISOString().split('T')[0]}.csv`;
			a.click();
			window.URL.revokeObjectURL(url);

			toast.success('Datele tale personale au fost descărcate');
		} catch (error: any) {
			console.error('Download personal data error:', error);
			toast.error(error.message || 'Eroare la descărcarea datelor');
		} finally {
			downloadingData = false;
		}
	}

	function openDeleteAccountDialog() {
		showDeleteAccountDialog = true;
		deleteAccountPassword = '';
		deleteAccountError = '';
	}

	function closeDeleteAccountDialog() {
		showDeleteAccountDialog = false;
		deleteAccountPassword = '';
		deleteAccountError = '';
	}

	async function confirmDeleteAccount() {
		if (!deleteAccountPassword.trim()) {
			deleteAccountError = 'Introdu parola pentru confirmare';
			return;
		}

		try {
			deletingAccount = true;
			deleteAccountError = '';

			const response = await fetch('/api/admin/reports/delete-account', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${$authStore.token}`
				},
				body: JSON.stringify({ password: deleteAccountPassword })
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Nu s-a putut șterge contul');
			}

			toast.success('Contul tău a fost șters. Vei fi deconectat.');
			
			// Log out and redirect
			setTimeout(() => {
				authStore.logout();
				window.location.href = '/';
			}, 2000);
		} catch (error: any) {
			console.error('Delete account error:', error);
			deleteAccountError = error.message || 'Eroare la ștergerea contului';
		} finally {
			deletingAccount = false;
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
					<h1 class="text-3xl font-bold text-gray-900 dark:text-slate-100">{fullName}</h1>
					<p class="text-gray-800 dark:text-slate-300 capitalize font-medium">{$authStore.user?.role}</p>
					{#if $isPacient}
						<p class="text-sm text-blue-600 dark:text-blue-400 mt-2">Gestionare preferințe, date personale și notificări</p>
					{:else}
						<p class="text-sm text-blue-600 dark:text-blue-400 mt-2">Setări cont, securitate și configurări aplicație</p>
					{/if}
				</div>
			</div>
		</div>

		<div class="flex flex-col md:flex-row gap-6">
			<div class="md:w-64 flex-shrink-0">
				<nav class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg p-2 space-y-1">
					{#each tabs as tab}
						{#if tab.show !== false}
							<button
								onclick={() => activeTab = tab.id}
								class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-md {activeTab === tab.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium scale-105 shadow-md' : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'}"
							>
								{#if tab.id === 'general'}
									<User class="w-5 h-5 flex-shrink-0" />
								{:else if tab.id === 'security'}
									<Lock class="w-5 h-5 flex-shrink-0" />
								{:else if tab.id === 'notifications'}
									<Bell class="w-5 h-5 flex-shrink-0" />
								{:else if tab.id === 'stats'}
									<BarChart3 class="w-5 h-5 flex-shrink-0" />
								{:else if tab.id === 'privacy'}
									<Shield class="w-5 h-5 flex-shrink-0" />
								{/if}
								<span class="truncate">{tab.name}</span>
							</button>
						{/if}
					{/each}
				</nav>
			</div>

			<div class="flex-1 min-w-0">
				{#if activeTab === 'general'}
					<div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg p-6">
						<h2 class="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-6">Informații generale</h2>
						<form onsubmit={(e) => { e.preventDefault(); handleSaveProfile(); }} class="space-y-6">
							<div>
								<label for="fullName" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
									Nume complet
								</label>
								<input
									type="text"
									id="fullName"
									bind:value={fullName}
									class="w-full px-4 py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100"
									placeholder="Numele tău complet"
									required
								/>
							</div>

							<div>
								<label for="email" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
									Email
								</label>
								<input
									type="email"
									id="email"
									bind:value={email}
									class="w-full px-4 py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100"
									placeholder="email@example.com"
									required
								/>
							</div>

							<div>
								<label for="avatarUrl" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
									URL avatar (opțional)
								</label>
								<input
									type="url"
									id="avatarUrl"
									bind:value={avatarUrl}
									class="w-full px-4 py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100"
									placeholder="https://example.com/avatar.jpg"
								/>
								{#if avatarUrl}
									<div class="mt-3 flex items-center gap-3">
										<img src={avatarUrl} alt="Preview" class="w-12 h-12 rounded-full object-cover border-2 border-slate-300 dark:border-slate-600" />
										<span class="text-sm text-gray-700 dark:text-slate-300">Previzualizare avatar</span>
									</div>
								{/if}
							</div>

							<div class="flex justify-end pt-4 border-t border-gray-200 dark:border-slate-700">
								<button
									type="submit"
									disabled={savingProfile}
									class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
								>
									{#if savingProfile}
										<Loader class="animate-spin h-4 w-4" />
										Se salvează...
									{:else}
										<CheckCircle2 class="w-5 h-5" />
										Salvează modificările
									{/if}
								</button>
							</div>
						</form>
					</div>
				{/if}

				{#if activeTab === 'security'}
					<div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg p-6">
						<h2 class="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-6">Securitate</h2>
						<form onsubmit={(e) => { e.preventDefault(); handleChangePassword(); }} class="space-y-6">
							<div>
								<label for="currentPassword" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
									Parola curentă
								</label>
								<input
									type={showPasswords ? 'text' : 'password'}
									id="currentPassword"
									bind:value={currentPassword}
									class="w-full px-4 py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100"
									placeholder="••••••••"
									required
								/>
							</div>

							<div>
								<label for="newPassword" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
									Parola nouă
								</label>
								<input
									type={showPasswords ? 'text' : 'password'}
									id="newPassword"
									bind:value={newPassword}
									class="w-full px-4 py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100"
									placeholder="••••••••"
									required
								/>
							</div>

							<div>
								<label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
									Confirmă parola nouă
								</label>
								<input
									type={showPasswords ? 'text' : 'password'}
									id="confirmPassword"
									bind:value={confirmPassword}
									class="w-full px-4 py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100"
									placeholder="••••••••"
									required
								/>
							</div>

							<div class="flex items-center">
								<input
									type="checkbox"
									id="showPasswords"
									bind:checked={showPasswords}
									class="w-4 h-4 text-blue-600 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500"
								/>
								<label for="showPasswords" class="ml-2 text-sm text-gray-700 dark:text-slate-300">
									Arată parolele
								</label>
							</div>

							<div class="flex justify-end pt-4 border-t border-gray-200 dark:border-slate-700">
								<button
									type="submit"
									disabled={savingPassword}
									class="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 hover:shadow-xl hover:shadow-purple-500/50 hover:scale-105 active:scale-95 disabled:bg-gray-400 disabled:hover:scale-100 disabled:hover:shadow-none text-white rounded-lg transition-all duration-300 ease-in-out flex items-center gap-2"
								>
									{#if savingPassword}
										<Loader class="animate-spin h-4 w-4" />
										Se schimbă...
									{:else}
										<Key class="w-5 h-5" />
										Schimbă parola
									{/if}
								</button>
							</div>
						</form>
					</div>

					<div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg p-6 mt-6">
						<div class="flex items-center gap-3 mb-6">
							<div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
								<Lock class="w-6 h-6 text-white" />
							</div>
							<div>
								<h3 class="text-xl font-semibold text-gray-900 dark:text-slate-100">Autentificare în doi pași (2FA)</h3>
								<p class="text-sm text-gray-700 dark:text-slate-300">Protecție suplimentară pentru contul tău</p>
							</div>
						</div>

						{#if mfaStep === 'idle'}
							<div class="space-y-4">
								<div class="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
									<Info class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
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
									<Shield class="w-5 h-5" />
									Activează 2FA
								</button>
							</div>
						{/if}

						{#if mfaStep === 'verify'}
							<div class="space-y-5">
								<div class="flex flex-col items-center p-6 bg-white/70 dark:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
									<p class="text-sm text-gray-700 dark:text-slate-300 mb-4 text-center">Scanează acest cod QR în aplicația ta de autentificare</p>
									<div class="bg-white p-4 rounded-lg shadow-md">
										<img src={mfaQr} alt="QR Code 2FA" class="w-48 h-48" />
									</div>
									<p class="text-xs text-gray-500 dark:text-slate-500 mt-3 text-center">Google Authenticator · Authy · Microsoft Authenticator</p>
								</div>
								<div>
									<label for="mfaTotp" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
										Introdu codul de verificare (6 cifre)
									</label>
									<div class="relative">
										<input 
											id="mfaTotp" 
											type="text"
											class="w-full px-4 py-3 text-lg tracking-widest text-center border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono" 
											bind:value={mfaTotp} 
											maxlength={6} 
											placeholder="000000"
											autocomplete="off"
											aria-describedby={`mfa-help${mfaError ? ' mfa-error-setup' : ''}`}
											oninput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, ''); }}
										/>
										{#if mfaTotp.length === 6}
											<div class="absolute right-3 top-1/2 -translate-y-1/2">
												<CheckCircle2 class="w-5 h-5 text-green-500" />
											</div>
										{/if}
									</div>
										<div id="mfa-help" class="mt-2 flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300">
										<Info class="w-4 h-4" />
										<span>Codul se actualizează la fiecare 30 de secunde</span>
									</div>
								</div>
								{#if mfaError}
									<div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-shake">
										<XCircle class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
											<p id="mfa-error-setup" class="text-sm text-red-700 dark:text-red-300">{mfaError}</p>
									</div>
								{/if}
								<div class="flex gap-3">
									<button 
										class="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 hover:shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium" 
										disabled={mfaWorking || mfaTotp.length!==6} 
										onclick={verifyMfaSetup}
									>
										{#if mfaWorking}
											<Loader class="animate-spin h-5 w-5" />
											Se verifică...
										{:else}
											<CheckCircle2 class="w-5 h-5" />
											Verifică și activează
										{/if}
									</button>
									<button 
										class="px-6 py-3 border border-slate-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-all font-medium"
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
									<CheckCircle2 class="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
									<div>
										<p class="font-medium text-green-900 dark:text-green-100">Autentificarea în doi pași este activată</p>
										<p class="text-sm text-green-700 dark:text-green-300 mt-1">Contul tău este acum mai bine protejat.</p>
									</div>
								</div>

								{#if mfaBackupCodes.length > 0}
									<div class="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
										<div class="flex items-start gap-3 mb-3">
											<AlertTriangle class="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
											<div class="flex-1">
												<p class="font-medium text-amber-900 dark:text-amber-100 mb-1">Coduri de backup</p>
												<p class="text-sm text-amber-700 dark:text-amber-300 mb-3">Salvează aceste coduri într-un loc sigur. Poți folosi fiecare o singură dată dacă pierzi accesul la aplicația de autentificare.</p>
												<div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-4 rounded-lg border border-amber-300 dark:border-amber-700 font-mono text-sm space-y-1.5">
													{#each mfaBackupCodes as code}
														<div class="text-gray-900 dark:text-slate-100 py-1">{code}</div>
													{/each}
												</div>
												<div class="flex gap-2 mt-4">
													<button 
														class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium hover:shadow-lg hover:scale-105 active:scale-95"
														onclick={copyAllBackupCodes}
														disabled={copiedCode}
													>
														{#if copiedCode}
															<CheckCircle2 class="w-4 h-4" />
															Copiat!
														{:else}
															<Copy class="w-4 h-4" />
															Copiază toate
														{/if}
													</button>
													<button 
														class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium hover:shadow-lg hover:scale-105 active:scale-95"
														onclick={downloadBackupCodes}
													>
														<Download class="w-4 h-4" />
														Descarcă .txt
													</button>
												</div>
											</div>
										</div>
									</div>
								{/if}

								<div class="flex flex-wrap gap-3 pt-2 border-t border-gray-200 dark:border-slate-700">
									<button 
										class="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 hover:shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 text-white rounded-lg transition-all duration-200 flex items-center gap-2 font-medium" 
										onclick={regenerateBackupCodes} 
										disabled={mfaWorking}
									>
										<RotateCcw class="w-4 h-4" />
										Generează coduri noi
									</button>
									<button 
										class="px-5 py-2.5 bg-red-600 hover:bg-red-700 hover:shadow-lg hover:scale-105 active:scale-95 text-white rounded-lg transition-all duration-200 flex items-center gap-2 font-medium" 
										onclick={openDisableMfaDialog}
									>
										<X class="w-4 h-4" />
										Dezactivează 2FA
									</button>
								</div>
							</div>
						{/if}
					</div>
				{/if}

				{#if activeTab === 'notifications'}
					<div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg p-6">
						<h2 class="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-6">Setări notificări</h2>

						<!-- Push Notifications Section -->
						<div class="space-y-6">
							<div class="flex items-center gap-3 mb-4">
								<div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
									<Bell class="w-6 h-6 text-white" />
								</div>
								<div>
									<h3 class="text-xl font-semibold text-gray-900 dark:text-slate-100">Notificări Push</h3>
									<p class="text-sm text-gray-500 dark:text-slate-400">Primește notificări pentru medicamente și mesaje</p>
								</div>
							</div>

							<!-- Permission Status -->
							<div class="p-4 rounded-lg border {pushPermission === 'granted' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : pushPermission === 'denied' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'}">
								<div class="flex items-start gap-3">
									{#if pushPermission === 'granted'}
										<CheckCircle2 class="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
										<div>
											<p class="font-medium text-green-900 dark:text-green-100">Permisiuni acordate</p>
											<p class="text-sm text-green-700 dark:text-green-300 mt-1">Browser-ul tău poate trimite notificări push</p>
										</div>
									{:else if pushPermission === 'denied'}
										<XCircle class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
										<div>
											<p class="font-medium text-red-900 dark:text-red-100">Permisiuni refuzate</p>
											<p class="text-sm text-red-700 dark:text-red-300 mt-1">Activează notificările în setările browser-ului</p>
										</div>
									{:else}
										<Info class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
										<div>
											<p class="font-medium text-blue-900 dark:text-blue-100">Permisiuni necesare</p>
											<p class="text-sm text-blue-700 dark:text-blue-300 mt-1">Activează notificările pentru a primi alerte</p>
										</div>
									{/if}
								</div>
							</div>

							<!-- Subscription Toggle -->
							<div class="flex items-center justify-between p-4 bg-white/70 dark:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
								<div class="flex-1">
									<h4 class="font-medium text-gray-900 dark:text-slate-100">Notificări Push Active</h4>
									<p class="text-sm text-gray-600 dark:text-slate-400 mt-1">
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
									class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed {pushSubscribed ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'}"
								>
									<span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {pushSubscribed ? 'translate-x-5' : 'translate-x-0'}"></span>
								</button>
							</div>

							<!-- Test Notification (Admin Only) -->
							{#if $authStore.user?.role === 'admin'}
								<div class="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
									<div class="flex items-start gap-3">
										<Zap class="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
										<div class="flex-1">
											<p class="font-medium text-purple-900 dark:text-purple-100 mb-1">Test Notificare (Admin)</p>
											<p class="text-sm text-purple-700 dark:text-purple-300 mb-3">Trimite o notificare de test pentru a verifica configurarea</p>
											<button
												onclick={handleTestPushNotification}
												disabled={testingPush || !pushSubscribed}
												class="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium hover:shadow-lg hover:scale-105 active:scale-95"
											>
												{#if testingPush}
													<Loader class="animate-spin h-4 w-4" />
													Se trimite...
												{:else}
													<Zap class="w-4 h-4" />
													Trimite notificare test
												{/if}
											</button>
										</div>
									</div>
								</div>
							{/if}

							<!-- Info Card -->
							<div class="p-4 bg-white/70 dark:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
								<div class="flex items-start gap-3">
									<Info class="w-5 h-5 text-gray-700 dark:text-slate-300 mt-0.5 flex-shrink-0" />
									<div class="text-sm text-gray-700 dark:text-slate-300">
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
						<div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg p-6">
							<h2 class="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-6">Statistici și realizări</h2>
							
							<div class="flex flex-col items-center mb-8">
								<div class="w-32 h-32 bg-gradient-to-br {getBadgeColor(stats.currentBadge)} rounded-full flex items-center justify-center mb-4 shadow-lg">
									<Star class="w-16 h-16 text-white" fill="currentColor" />
								</div>
								<h3 class="text-2xl font-bold text-gray-900 dark:text-slate-100">{getBadgeName(stats.currentBadge)}</h3>
							<p class="text-lg text-gray-700 dark:text-slate-300">{stats?.totalXp ?? 0} XP</p>
							</div>

							<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
								<div class="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
							<p class="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats?.currentStreak ?? 0}</p>
									<p class="text-sm text-gray-700 dark:text-slate-300 mt-1">Zile consecutive</p>
								</div>
								<div class="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
							<p class="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats?.longestStreak ?? 0}</p>
									<p class="text-sm text-gray-700 dark:text-slate-300 mt-1">Record</p>
								</div>
								<div class="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
								<p class="text-3xl font-bold text-green-600 dark:text-green-400">{stats?.completedTreatments ?? 0}</p>
									<p class="text-sm text-gray-700 dark:text-slate-300 mt-1">Tratamente finalizate</p>
								</div>
								<div class="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
								<p class="text-3xl font-bold text-orange-600 dark:text-orange-400">{stats?.activeTreatments ?? 0}</p>
									<p class="text-sm text-gray-700 dark:text-slate-300 mt-1">Tratamente active</p>
								</div>
							</div>
						</div>

						<div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg p-6">
							<h3 class="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Progresie badge-uri</h3>
							<div class="space-y-4">
								{#each BADGES as badge}
									<div class="flex items-center gap-4">
										<div class="w-12 h-12 bg-gradient-to-br {badge.gradient} rounded-full flex items-center justify-center flex-shrink-0">
											<Star class="w-6 h-6 text-white" fill="currentColor" />
										</div>
										<div class="flex-1">
											<p class="font-medium text-gray-900 dark:text-slate-100">{badge.name}</p>
											<p class="text-sm text-gray-700 dark:text-slate-300">{badge.xp} XP necesar</p>
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

				{#if activeTab === 'privacy'}
					<div class="space-y-6">
					<!-- GDPR Header -->
					<div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg p-6">
						<div class="flex items-center gap-3 mb-4">
							<div class="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
								<Shield class="w-6 h-6 text-white" />
							</div>
							<div>
								<h2 class="text-2xl font-semibold text-gray-900 dark:text-slate-100">Confidențialitate și Date Personale</h2>
								<p class="text-sm text-gray-600 dark:text-slate-400">Gestionare date conform GDPR</p>
							</div>
						</div>

						<div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
							<div class="flex items-start gap-3">
								<Info class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
								<div class="text-sm text-blue-900 dark:text-blue-100">
									<p class="font-medium mb-1">Protecția datelor tale</p>
									<p class="text-blue-700 dark:text-blue-300">Conform GDPR, ai dreptul la:</p>
									<ul class="list-disc list-inside mt-2 space-y-1 text-blue-700 dark:text-blue-300">
										<li>Acces la datele tale personale</li>
										<li>Export complet al informațiilor tale</li>
										<li>Ștergerea contului și a datelor asociate</li>
										<li>Confidențialitate și securitate maximă</li>
									</ul>
								</div>
							</div>
						</div>
					</div>

					<!-- Export Personal Data -->
					<div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg p-6">
						<div class="flex items-start gap-4">
							<div class="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
								<Download class="w-5 h-5 text-blue-600 dark:text-blue-400" />
							</div>
							<div class="flex-1">
								<h3 class="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">Descarcă datele tale personale</h3>
								<p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
									Primești un fișier CSV cu toate informațiile tale: date cont, tratamente, confirmări medicamente și istoric.
								</p>
								<button
									onclick={handleDownloadPersonalData}
									disabled={downloadingData}
									class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 flex items-center gap-2 font-medium"
								>
									{#if downloadingData}
										<Loader class="animate-spin h-4 w-4" />
										Se descarcă...
									{:else}
										<Download class="w-4 h-4" />
										Descarcă datele mele (CSV)
									{/if}
								</button>
							</div>
						</div>
					</div>

					<!-- Cookie Consent Info -->
					<div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg p-6">
						<div class="flex items-start gap-4">
							<div class="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
								<Cookie class="w-5 h-5 text-purple-600 dark:text-purple-400" />
							</div>
							<div class="flex-1">
								<h3 class="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">Cookies și tracking</h3>
								<p class="text-sm text-gray-600 dark:text-slate-400 mb-3">
									MediTrack folosește doar cookies esențiale pentru autentificare și preferințe UI (tema dark/light).
								</p>
								<div class="space-y-2 text-sm">
									<div class="flex items-center gap-2">
										<CheckCircle2 class="w-4 h-4 text-green-600 dark:text-green-400" />
										<span class="text-gray-700 dark:text-slate-300">Fără tracking de terțe părți</span>
									</div>
									<div class="flex items-center gap-2">
										<CheckCircle2 class="w-4 h-4 text-green-600 dark:text-green-400" />
										<span class="text-gray-700 dark:text-slate-300">Fără publicitate</span>
									</div>
									<div class="flex items-center gap-2">
										<CheckCircle2 class="w-4 h-4 text-green-600 dark:text-green-400" />
										<span class="text-gray-700 dark:text-slate-300">Datele medicale rămân confidențiale</span>
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- Delete Account -->
					<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl shadow-sm p-6">
						<div class="flex items-start gap-4">
							<div class="flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900/40 rounded-lg flex items-center justify-center">
								<AlertTriangle class="w-5 h-5 text-red-600 dark:text-red-400" />
							</div>
							<div class="flex-1">
								<h3 class="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">Șterge contul definitiv</h3>
								<p class="text-sm text-red-700 dark:text-red-300 mb-4">
									<strong>Atenție:</strong> Această acțiune este ireversibilă. Toate datele tale personale vor fi anonimizate sau șterse:
								</p>
								<ul class="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1 mb-4">
									<li>Informații cont (nume, email, parolă)</li>
									<li>Toate tratamentele și medicamentele</li>
									<li>Istoric confirmări și notificări</li>
									<li>Mesaje și colaborări cu medici</li>
									<li>Statistici și progres (XP, streak-uri, badge-uri)</li>
								</ul>
								<button
									onclick={openDeleteAccountDialog}
									class="px-5 py-2.5 bg-red-600 hover:bg-red-700 hover:shadow-lg hover:scale-105 active:scale-95 text-white rounded-lg transition-all duration-200 flex items-center gap-2 font-medium"
								>
									<Trash2 class="w-4 h-4" />
									Șterge contul meu
								</button>
							</div>
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
		<p class="text-sm text-gray-600 dark:text-slate-400">
			Codurile vechi vor fi invalidate. Introdu un cod TOTP pentru confirmare.
		</p>
		<div>
			<label for="regenerateTotp" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
				Cod autentificator (6 cifre)
			</label>
			<input 
				id="regenerateTotp" 
				type="text"
				class="w-full px-4 py-2.5 text-lg tracking-widest text-center border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all font-mono" 
				bind:value={regenerateTotp} 
				maxlength={6} 
				placeholder="000000"
				autocomplete="off"
				aria-describedby={mfaError ? 'mfa-error-regenerate' : undefined}
				oninput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, ''); }}
			/>
		</div>
		{#if mfaError}
			<div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
				<XCircle class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
				<p id="mfa-error-regenerate" class="text-sm text-red-700 dark:text-red-300">{mfaError}</p>
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
		<p class="text-sm text-gray-600 dark:text-slate-400">
			Autentificarea cu doi factori va fi dezactivată complet. Introdu parola pentru confirmare.
		</p>
		<div>
			<label for="disableMfaPassword" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
				Parola ta
			</label>
			<input 
				id="disableMfaPassword" 
				type="password"
				class="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all" 
				bind:value={disableMfaPassword} 
				placeholder="Introdu parola"
				autocomplete="current-password"
				aria-describedby={mfaError ? 'mfa-error-disable' : undefined}
			/>
		</div>
		{#if mfaError}
			<div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
				<XCircle class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
				<p id="mfa-error-disable" class="text-sm text-red-700 dark:text-red-300">{mfaError}</p>
			</div>
		{/if}
	</div>
</Modal>

<!-- Delete Account Confirmation Modal -->
<Modal
	isOpen={showDeleteAccountDialog}
	title="Șterge cont definitiv"
	type="error"
	size="md"
	showCancel={true}
	confirmText={deletingAccount ? 'Se șterge...' : 'Șterge contul definitiv'}
	cancelText="Anulează"
	isLoading={deletingAccount}
	onConfirm={confirmDeleteAccount}
	onCancel={closeDeleteAccountDialog}
	onClose={closeDeleteAccountDialog}
>
	<div class="space-y-4">
		<div class="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
			<div class="flex items-start gap-3">
				<AlertTriangle class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
				<div class="text-sm text-red-900 dark:text-red-100">
					<p class="font-bold mb-2">Această acțiune este IREVERSIBILĂ!</p>
					<p class="text-red-700 dark:text-red-300">Toate datele tale vor fi șterse permanent:</p>
					<ul class="list-disc list-inside mt-2 space-y-1 text-red-700 dark:text-red-300">
						<li>Cont și informații personale</li>
						<li>Tratamente și medicamente</li>
						<li>Istoric și confirmări</li>
						<li>Mesaje și colaborări</li>
						<li>Statistici și realizări</li>
					</ul>
				</div>
			</div>
		</div>

		<p class="text-sm text-gray-600 dark:text-slate-400">
			Pentru confirmare, introdu parola ta:
		</p>
		
		<div>
			<label for="deleteAccountPassword" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
				Parola contului
			</label>
			<input 
				id="deleteAccountPassword" 
				type="password"
				class="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all" 
				bind:value={deleteAccountPassword} 
				placeholder="Introdu parola pentru confirmare"
				autocomplete="current-password"
				aria-describedby={deleteAccountError ? 'delete-account-error' : undefined}
			/>
		</div>
		
		{#if deleteAccountError}
			<div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
				<XCircle class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
				<p id="delete-account-error" class="text-sm text-red-700 dark:text-red-300">{deleteAccountError}</p>
			</div>
		{/if}
	</div>
</Modal>