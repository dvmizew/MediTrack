<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore, isMedic, isPacient } from '$lib/stores/auth';
	import { api, adminReportsApi } from '$lib/api/client';
	import { toast } from '$lib/utils/toast';

	let collaborations = $state<any[]>([]);
	let pendingInvites = $state<any[]>([]);
	let adminOverview = $state<any>(null);
	let loading = $state(true);
	let error = $state('');
	let medicEmail = $state('');
	let sending = $state(false);
	let respondingToInvite = $state<number | null>(null);
	
	let isAdmin = $derived($authStore.user?.role === 'admin');

	onMount(async () => {
		if (!$authStore.isAuthenticated) {
			goto('/');
			return;
		}
		await loadData();
	});

	async function loadData() {
		try {
			loading = true;
			error = '';
			
			if (isAdmin) {
				// Admin loads global overview
				adminOverview = await adminReportsApi.getOverview();
			} else {
				// Regular users load their collaborations
				const [collabData, pendingData] = await Promise.all([
					api.getMyCollaborations(),
					api.getPendingInvites()
				]);
				collaborations = collabData;
				pendingInvites = pendingData;
			}
		} catch (err: any) {
			console.error('Failed to load data:', err);
			error = err.message || 'Nu s-au putut încărca datele';
			toast.error(error);
		} finally {
			loading = false;
		}
	}

	async function sendInvite() {
		if (!medicEmail.trim()) return;
		try {
			sending = true;
			error = '';
			await api.sendInvite(medicEmail);
			
			toast.success(`Am trimis invitația către ${medicEmail}`);
			
			medicEmail = '';
			await loadData();
		} catch (err: any) {
			console.error('Failed to send invite:', err);
			error = err.message || 'Nu s-a putut trimite invitația';
			toast.error(error);
		} finally {
			sending = false;
		}
	}

	async function respondToInvite(inviteId: number, action: 'accept' | 'reject') {
		try {
			respondingToInvite = inviteId;
			error = '';
			await api.respondToInvite(inviteId, action);
			
			if (action === 'accept') {
			toast.success('Colaborarea a fost adăugată cu succes');
		} else {
			toast.info('Invitația a fost respinsă');
			}
			
			await loadData();
		} catch (err: any) {
			console.error('Failed to respond to invite:', err);
			error = err.message || 'Nu s-a putut răspunde la invitație';
		toast.error(error);
		} finally {
			respondingToInvite = null;
		}
	}
</script>

{#if $authStore.isAuthenticated}
	<main class="page-transition max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
		<div class="mb-6 sm:mb-8">
			<h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">🤝 Colaborări</h1>
			<p class="text-sm sm:text-base text-gray-600 dark:text-gray-400">
				{#if isAdmin}
					Overview global al tuturor colaborărilor din sistem
				{:else if $isMedic}
					Gestionează colaborările cu pacienții tăi
				{:else}
					Gestionează colaborările cu medicii tăi
				{/if}
			</p>
		</div>

		{#if error}
			<div class="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-4 sm:p-6 mb-6 flex items-start gap-3 animate-shake">
				<svg class="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
				</svg>
				<p class="text-sm sm:text-base text-red-800 dark:text-red-400 font-medium">{error}</p>
			</div>
		{/if}

		{#if isAdmin}
			<!-- Admin View: Global Statistics -->
			{#if loading}
				<div class="flex justify-center py-16">
					<div class="animate-spin rounded-full h-12 w-12 border-3 border-blue-600 border-t-transparent shadow-lg shadow-blue-500/50"></div>
				</div>
			{:else if adminOverview}
				<!-- Stats Cards -->
				<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
					<div class="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/30 border border-green-200 dark:border-green-800 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5">
						<div class="flex items-center gap-1.5 sm:gap-2 mb-2">
							<span class="text-base sm:text-lg">✅</span>
							<h3 class="text-xs sm:text-sm font-semibold text-green-900 dark:text-green-300 truncate">Acceptate</h3>
						</div>
						<p class="text-xl sm:text-2xl md:text-3xl font-bold text-green-900 dark:text-green-100 mb-1">
							{adminOverview.collaborations.find((c: any) => c.status === 'accepted')?.count || 0}
						</p>
						<p class="text-xs text-green-700 dark:text-green-400 truncate">Active în sistem</p>
					</div>

					<div class="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5">
						<div class="flex items-center gap-1.5 sm:gap-2 mb-2">
							<span class="text-base sm:text-lg">⏳</span>
							<h3 class="text-xs sm:text-sm font-semibold text-yellow-900 dark:text-yellow-300 truncate">În așteptare</h3>
						</div>
						<p class="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-900 dark:text-yellow-100 mb-1">
							{adminOverview.collaborations.find((c: any) => c.status === 'pending')?.count || 0}
						</p>
						<p class="text-xs text-yellow-700 dark:text-yellow-400 truncate">De procesat</p>
					</div>

					<div class="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/30 border border-red-200 dark:border-red-800 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5">
						<div class="flex items-center gap-1.5 sm:gap-2 mb-2">
							<span class="text-base sm:text-lg">❌</span>
							<h3 class="text-xs sm:text-sm font-semibold text-red-900 dark:text-red-300 truncate">Respinse</h3>
						</div>
						<p class="text-xl sm:text-2xl md:text-3xl font-bold text-red-900 dark:text-red-100 mb-1">
							{adminOverview.collaborations.find((c: any) => c.status === 'rejected')?.count || 0}
						</p>
						<p class="text-xs text-red-700 dark:text-red-400 truncate">Nefinalizate</p>
					</div>
				</div>

				<!-- Detailed Breakdown -->
				<div class="grid gap-4 sm:gap-6 md:grid-cols-2">
					<!-- Status Breakdown -->
					<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
						<div class="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
							<h2 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">📊 Detalii Status</h2>
							<p class="text-xs text-gray-600 dark:text-gray-400 mt-1">Distribuție pe statusuri</p>
						</div>
						<div class="p-4 sm:p-6 space-y-4">
							{#each adminOverview.collaborations as c}
								<div class="space-y-2">
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-2">
											{#if c.status === 'pending'}
												<span class="text-lg sm:text-xl">⏳</span>
												<span class="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100">În așteptare</span>
											{:else if c.status === 'accepted'}
												<span class="text-lg sm:text-xl">✅</span>
												<span class="text-sm sm:text-base font-medium text-green-900 dark:text-green-100">Acceptate</span>
											{:else if c.status === 'rejected'}
												<span class="text-lg sm:text-xl">❌</span>
												<span class="text-sm sm:text-base font-medium text-red-900 dark:text-red-100">Respinse</span>
											{/if}
										</div>
										<span class="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">{c.count}</span>
									</div>
									<!-- Progress bar -->
									<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 sm:h-2.5 overflow-hidden">
										<div 
											class="{c.status === 'accepted' ? 'bg-gradient-to-r from-green-500 to-green-600' : c.status === 'pending' ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' : 'bg-gradient-to-r from-red-500 to-red-600'} h-full transition-all duration-500 rounded-full"
											style="width: {adminOverview.collaborations.reduce((sum: any, collab: any) => sum + collab.count, 0) > 0 ? (c.count / adminOverview.collaborations.reduce((sum: any, collab: any) => sum + collab.count, 0)) * 100 : 0}%"
										></div>
									</div>
									<div class="text-xs text-gray-500 dark:text-gray-400">
										{Math.round((c.count / adminOverview.collaborations.reduce((sum: any, collab: any) => sum + collab.count, 0)) * 100)}% din total
									</div>
								</div>
							{/each}
							
							<!-- Summary -->
							<div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
								<div class="flex justify-between text-sm">
									<span class="text-gray-600 dark:text-gray-400">Total colaborări:</span>
									<span class="font-bold text-gray-900 dark:text-gray-100">
										{adminOverview.collaborations.reduce((sum: any, collab: any) => sum + collab.count, 0)}
									</span>
								</div>
								<div class="flex justify-between text-sm">
									<span class="text-gray-600 dark:text-gray-400">Rata acceptare:</span>
									<span class="font-bold {(adminOverview.collaborations.find((c: any) => c.status === 'accepted')?.count || 0) / adminOverview.collaborations.reduce((sum: any, collab: any) => sum + collab.count, 0) > 0.8 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}">
										{Math.round(((adminOverview.collaborations.find((c: any) => c.status === 'accepted')?.count || 0) / adminOverview.collaborations.reduce((sum: any, collab: any) => sum + collab.count, 0)) * 100)}%
									</span>
								</div>
							</div>
						</div>
					</div>

					<!-- Quick Actions -->
					<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
						<div class="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
							<h2 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">⚡ Acțiuni Rapide</h2>
							<p class="text-xs text-gray-600 dark:text-gray-400 mt-1">Administrare sistem</p>
						</div>
						<div class="p-4 sm:p-6 space-y-3">
							<a
								href="/admin/users"
								class="block p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200"
							>
								<div class="flex items-center gap-3">
									<div class="text-2xl sm:text-3xl">👥</div>
									<div class="flex-1 min-w-0">
										<h3 class="text-sm sm:text-base font-semibold text-blue-900 dark:text-blue-100 truncate">Gestionează Utilizatori</h3>
										<p class="text-xs text-blue-700 dark:text-blue-300 truncate">Vezi toți utilizatorii</p>
									</div>
									<svg class="w-5 h-5 text-blue-400 dark:text-blue-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
									</svg>
								</div>
							</a>

							<a
								href="/admin/reports"
								class="block p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/30 border border-green-200 dark:border-green-800 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200"
							>
								<div class="flex items-center gap-3">
									<div class="text-2xl sm:text-3xl">📊</div>
									<div class="flex-1 min-w-0">
										<h3 class="text-sm sm:text-base font-semibold text-green-900 dark:text-green-100 truncate">Rapoarte Detaliate</h3>
										<p class="text-xs text-green-700 dark:text-green-300 truncate">Export și analize</p>
									</div>
									<svg class="w-5 h-5 text-green-400 dark:text-green-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
									</svg>
								</div>
							</a>

							<a
								href="/dashboard"
								class="block p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200"
							>
								<div class="flex items-center gap-3">
									<div class="text-2xl sm:text-3xl">📈</div>
									<div class="flex-1 min-w-0">
										<h3 class="text-sm sm:text-base font-semibold text-purple-900 dark:text-purple-100 truncate">Dashboard Admin</h3>
										<p class="text-xs text-purple-700 dark:text-purple-300 truncate">Overview complet</p>
									</div>
									<svg class="w-5 h-5 text-purple-400 dark:text-purple-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
									</svg>
								</div>
							</a>
						</div>
					</div>
				</div>
			{/if}
		{:else}
			<!-- Send Invite Form (Pacient only) -->
			{#if $isPacient}
				<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6 hover:shadow-lg transition-shadow duration-300 animate-scale-in">
					<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
						<svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
						</svg>
						Invită un Medic
					</h2>
					<form onsubmit={(e) => { e.preventDefault(); sendInvite(); }} class="flex gap-3">
						<input
							type="email"
							bind:value={medicEmail}
							placeholder="Email medic (ex: medic@test.com)"
							class="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:scale-[1.01] transition-all duration-200"
							required
						/>
						<button
							type="submit"
							disabled={sending || !medicEmail.trim()}
							class="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 hover:shadow-lg hover:shadow-blue-500/50 hover:scale-105 active:scale-95 font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all duration-200 min-w-[160px]"
						>
							{#if sending}
								<span class="flex items-center justify-center gap-2">
									<svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									Se trimite...
								</span>
							{:else}
								<span class="flex items-center justify-center gap-2">
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
									</svg>
									Trimite Invitația
								</span>
							{/if}
						</button>
					</form>
				</div>
			{/if}

			<!-- Pending Invites -->
			{#if pendingInvites.length > 0}
				<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6 animate-scale-in">
					<div class="p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-yellow-50 to-white dark:from-yellow-900/10 dark:to-gray-800">
						<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
							<svg class="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
							</svg>
							Invitații în Așteptare
						</h2>
					</div>
					<div class="divide-y divide-gray-100 dark:divide-gray-700">
						{#each pendingInvites as invite}
							<div class="flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
								<div class="flex items-center gap-4">
									<div class="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
										{$isMedic ? (invite.pacientName?.charAt(0).toUpperCase() || '?') : (invite.medicName?.charAt(0).toUpperCase() || '?')}
									</div>
								<div>
									<p class="font-semibold text-gray-900 dark:text-gray-100">{$isMedic ? invite.pacientName : invite.medicName}</p>
									<p class="text-sm text-gray-500 dark:text-gray-400">{$isMedic ? invite.pacientEmail : invite.medicEmail}</p>
									<p class="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
											<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
											</svg>
											{new Date(invite.created_at).toLocaleDateString('ro-RO')}
										</p>
									</div>
								</div>
							{#if $isMedic}
								<div class="flex gap-3">
									<button
										onclick={() => respondToInvite(invite.id, 'accept')}
										disabled={respondingToInvite === invite.id}
										class="px-5 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 hover:shadow-lg hover:shadow-green-500/50 hover:scale-105 active:scale-95 font-medium shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
									>
										{#if respondingToInvite === invite.id}
											<span class="flex items-center justify-center gap-1">
												<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
													<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
													<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
												</svg>
											</span>
										{:else}
											✓ Acceptă
										{/if}
									</button>
									<button
										onclick={() => respondToInvite(invite.id, 'reject')}
										disabled={respondingToInvite === invite.id}
										class="px-5 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/50 hover:scale-105 active:scale-95 font-medium shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
									>
										{#if respondingToInvite === invite.id}
											<span class="flex items-center justify-center gap-1">
												<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
													<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
													<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
												</svg>
											</span>
										{:else}
											✕ Refuză
										{/if}
									</button>
								</div>
							{:else}
								<span class="text-sm px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-lg font-medium flex items-center gap-2">
									<svg class="animate-pulse w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
										<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
									</svg>
									În așteptare...
								</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Active Collaborations -->
			<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden animate-scale-in">
				<div class="p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-green-50 to-white dark:from-green-900/10 dark:to-gray-800">
					<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
						<svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
						</svg>
						Colaborări Active
					</h2>
				</div>
				
				{#if loading}
					<div class="flex justify-center py-12">
						<div class="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent shadow-lg shadow-blue-500/50"></div>
					</div>
				{:else if collaborations.length === 0}
					<div class="p-12 text-center">
						<svg class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
						</svg>
						<p class="text-gray-500 dark:text-gray-400">Nicio colaborare activă încă</p>
					</div>
				{:else}
					<div class="grid gap-5 md:grid-cols-2 p-6">
						{#each collaborations as collab}
							<div class="border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-700/30 rounded-xl p-5 hover:border-green-300 dark:hover:border-green-600 hover:shadow-xl hover:shadow-green-500/10 hover:-translate-y-1 transition-all duration-300 group animate-scale-in">
								<div class="flex items-center gap-4 mb-4">
									<div class="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md group-hover:scale-110 transition-transform duration-300">
										{$isMedic ? (collab.pacientName?.charAt(0).toUpperCase() || '?') : (collab.medicName?.charAt(0).toUpperCase() || '?')}
									</div>
									<div class="flex-1">
										<h3 class="font-semibold text-gray-900 dark:text-gray-100 text-lg">{$isMedic ? collab.pacientName : collab.medicName}</h3>
										<p class="text-sm text-gray-500 dark:text-gray-400">{$isMedic ? collab.pacientEmail : collab.medicEmail}</p>
										<p class="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
											<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
											</svg>
											Din {new Date(collab.created_at).toLocaleDateString('ro-RO')}
										</p>
									</div>
								</div>
								<div class="flex gap-3">
									<button
										onclick={() => goto(`/chat/${$isMedic ? collab.patientId : collab.doctorId}`)}
										class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/50 hover:scale-105 active:scale-95 text-sm font-medium shadow-sm transition-all duration-200 flex items-center justify-center gap-2"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
										</svg>
										Mesaj
									</button>
									{#if $isMedic}
										<button
											onclick={() => goto(`/treatments?createNew=true&pacientId=${collab.patientId}`)}
											class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 hover:shadow-lg hover:shadow-green-500/50 hover:scale-105 active:scale-95 text-sm font-medium shadow-sm transition-all duration-200 flex items-center justify-center gap-2"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
											</svg>
											Tratament
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</main>
{/if}
