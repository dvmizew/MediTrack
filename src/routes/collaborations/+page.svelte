<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore, isMedic, isPacient } from '$lib/stores/auth';
	import { api, adminReportsApi } from '$lib/api/client';
	import { toast } from '$lib/utils/toast';
	import {
		AlertCircle,
		BarChart3,
		CalendarDays,
		Check,
		CheckCircle2,
		ChevronRight,
		ClipboardList,
		Clock,
		Handshake,
		LineChart,
		LoaderCircle,
		Mail,
		MessageCircle,
		Plus,
		Users,
		X,
		XCircle,
		Zap
	} from '@lucide/svelte';

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
			<h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2 flex items-center gap-2">
				<Handshake class="w-6 h-6 text-gray-900 dark:text-slate-100" />
				Colaborări
			</h1>
			<p class="text-sm sm:text-base text-gray-900 dark:text-slate-100 font-medium">
				{#if isAdmin}
				Gestionare relații medic-pacient, cereri și status colaborări sistem
				{:else if $isMedic}
					Gestionare cereri pacienți, acceptare colaborări și comunicare
				{:else}
					Cereri colaborare, relații cu medici și comunicare directă
				{/if}
			</p>
		</div>

		{#if error}
			<div class="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-4 sm:p-6 mb-6 flex items-start gap-3 animate-shake">
				<AlertCircle class="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
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
<div class="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border border-green-200 dark:border-green-700/50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 shadow-sm dark:shadow-md">
								<div class="flex items-center gap-1.5 sm:gap-2 mb-2">
									<CheckCircle2 class="w-4 h-4 sm:w-5 sm:h-5 text-green-700 dark:text-green-200" />
									<h3 class="text-xs sm:text-sm font-semibold text-green-900 dark:text-green-200 truncate">Acceptate</h3>
								</div>
								<p class="text-xl sm:text-2xl md:text-3xl font-bold text-green-900 dark:text-green-100 mb-1">
									{adminOverview.collaborations.find((c: any) => c.status === 'accepted')?.count || 0}
								</p>
								<p class="text-xs text-green-700 dark:text-green-300 truncate">Active în sistem</p>
					</div>

<div class="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border border-yellow-200 dark:border-yellow-700/50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 shadow-sm dark:shadow-md">
								<div class="flex items-center gap-1.5 sm:gap-2 mb-2">
									<Clock class="w-4 h-4 sm:w-5 sm:h-5 text-yellow-700 dark:text-yellow-200" />
									<h3 class="text-xs sm:text-sm font-semibold text-yellow-900 dark:text-yellow-200 truncate">În așteptare</h3>
								</div>
								<p class="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-900 dark:text-yellow-100 mb-1">
									{adminOverview.collaborations.find((c: any) => c.status === 'pending')?.count || 0}
								</p>
								<p class="text-xs text-yellow-700 dark:text-yellow-300 truncate">De procesat</p>
					</div>

				<div class="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border border-red-200 dark:border-red-700/50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 shadow-sm dark:shadow-md">
						<div class="flex items-center gap-1.5 sm:gap-2 mb-2">
							<XCircle class="w-4 h-4 sm:w-5 sm:h-5 text-red-700 dark:text-red-200" />
						<h3 class="text-xs sm:text-sm font-semibold text-red-900 dark:text-red-200 truncate">Respinse</h3>
					</div>
					<p class="text-xl sm:text-2xl md:text-3xl font-bold text-red-900 dark:text-red-100 mb-1">
						{adminOverview.collaborations.find((c: any) => c.status === 'rejected')?.count || 0}
					</p>
					<p class="text-xs text-red-700 dark:text-red-300 truncate">Nefinalizate</p>
					</div>
				</div>

				<!-- Detailed Breakdown -->
				<div class="grid gap-4 sm:gap-6 md:grid-cols-2">
					<!-- Status Breakdown -->
					<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg overflow-hidden">
						<div class="p-4 sm:p-6 border-b border-gray-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
							<h2 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
								<BarChart3 class="w-4 h-4 sm:w-5 sm:h-5 text-gray-700 dark:text-slate-200" />
								Detalii Status
							</h2>
							<p class="text-xs text-gray-700 dark:text-slate-300 mt-1">Distribuție pe statusuri</p>
						</div>
						<div class="p-4 sm:p-6 space-y-4">
							{#each adminOverview.collaborations as c}
								<div class="space-y-2">
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-2">
											{#if c.status === 'pending'}
												<Clock class="w-4 h-4 sm:w-5 sm:h-5 text-yellow-700 dark:text-yellow-200" />
													<span class="text-sm sm:text-base font-medium text-gray-900 dark:text-slate-100">În așteptare</span>
												{:else if c.status === 'accepted'}
												<CheckCircle2 class="w-4 h-4 sm:w-5 sm:h-5 text-green-700 dark:text-green-200" />
													<span class="text-sm sm:text-base font-medium text-green-900 dark:text-green-100">Acceptate</span>
												{:else if c.status === 'rejected'}
												<XCircle class="w-4 h-4 sm:w-5 sm:h-5 text-red-700 dark:text-red-200" />
													<span class="text-sm sm:text-base font-medium text-red-900 dark:text-red-100">Respinse</span>
												{/if}
											</div>
											<span class="text-lg sm:text-xl font-bold text-gray-900 dark:text-slate-100">{c.count}</span>
									</div>
									<!-- Progress bar -->
										<div class="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 sm:h-2.5 overflow-hidden">
										<div 
											class="{c.status === 'accepted' ? 'bg-gradient-to-r from-green-500 to-green-600' : c.status === 'pending' ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' : 'bg-gradient-to-r from-red-500 to-red-600'} h-full transition-all duration-500 rounded-full"
											style="width: {adminOverview.collaborations.reduce((sum: any, collab: any) => sum + collab.count, 0) > 0 ? (c.count / adminOverview.collaborations.reduce((sum: any, collab: any) => sum + collab.count, 0)) * 100 : 0}%"
										></div>
									</div>
												<div class="text-xs text-gray-700 dark:text-slate-300">
										{Math.round((c.count / adminOverview.collaborations.reduce((sum: any, collab: any) => sum + collab.count, 0)) * 100)}% din total
									</div>
								</div>
							{/each}
							
							<!-- Summary -->
						<div class="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 space-y-2">
								<div class="flex justify-between text-sm">
								<span class="text-gray-700 dark:text-slate-300">Total colaborări:</span>
								<span class="font-bold text-gray-900 dark:text-gray-100">
									{adminOverview.collaborations.reduce((sum: any, collab: any) => sum + collab.count, 0)}
								</span>
							</div>
							<div class="flex justify-between text-sm">
								<span class="text-gray-700 dark:text-slate-300">Rata acceptare:</span>
									<span class="font-bold {(adminOverview.collaborations.find((c: any) => c.status === 'accepted')?.count || 0) / adminOverview.collaborations.reduce((sum: any, collab: any) => sum + collab.count, 0) > 0.8 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}">
										{Math.round(((adminOverview.collaborations.find((c: any) => c.status === 'accepted')?.count || 0) / adminOverview.collaborations.reduce((sum: any, collab: any) => sum + collab.count, 0)) * 100)}%
									</span>
								</div>
							</div>
						</div>
					</div>

					<!-- Quick Actions -->
				<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg overflow-hidden">
					<div class="p-4 sm:p-6 border-b border-gray-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
						<h2 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
							<Zap class="w-4 h-4 sm:w-5 sm:h-5 text-gray-700 dark:text-slate-200" />
							Acțiuni Rapide
						</h2>
						<p class="text-xs text-gray-700 dark:text-slate-300 mt-1">Administrare sistem</p>
						</div>
						<div class="p-4 sm:p-6 space-y-3">
							<a
								href="/admin/users"
							class="block p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border border-blue-200 dark:border-blue-700/50 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200"
						>
							<div class="flex items-center gap-3">
								<Users class="w-6 h-6 sm:w-7 sm:h-7 text-blue-700 dark:text-blue-200" />
								<div class="flex-1 min-w-0">
									<h3 class="text-sm sm:text-base font-semibold text-blue-900 dark:text-blue-200 truncate">Gestionează Utilizatori</h3>
										<p class="text-xs text-blue-700 dark:text-blue-300 truncate">Vezi toți utilizatorii</p>
									</div>
								<ChevronRight class="w-5 h-5 text-blue-400 dark:text-blue-300 flex-shrink-0" />
								</div>
							</a>

							<a
								href="/admin/reports"
								class="block p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border border-green-200 dark:border-green-700/50 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200"
							>
								<div class="flex items-center gap-3">
									<BarChart3 class="w-6 h-6 sm:w-7 sm:h-7 text-green-700 dark:text-green-200" />
									<div class="flex-1 min-w-0">
										<h3 class="text-sm sm:text-base font-semibold text-green-900 dark:text-green-200 truncate">Rapoarte Detaliate</h3>
										<p class="text-xs text-green-700 dark:text-green-300 truncate">Export și analize</p>
									</div>
									<ChevronRight class="w-5 h-5 text-green-400 dark:text-green-300 flex-shrink-0" />
								</div>
							</a>

							<a
								href="/dashboard"
								class="block p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border border-purple-200 dark:border-purple-700/50 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200"
							>
								<div class="flex items-center gap-3">
									<LineChart class="w-6 h-6 sm:w-7 sm:h-7 text-purple-700 dark:text-purple-200" />
									<div class="flex-1 min-w-0">
										<h3 class="text-sm sm:text-base font-semibold text-purple-900 dark:text-purple-200 truncate">Dashboard Admin</h3>
										<p class="text-xs text-purple-700 dark:text-purple-300 truncate">Overview complet</p>
									</div>
									<ChevronRight class="w-5 h-5 text-purple-400 dark:text-purple-300 flex-shrink-0" />
								</div>
							</a>
						</div>
					</div>
				</div>
			{/if}
		{:else}
			<!-- Send Invite Form (Pacient only) -->
			{#if $isPacient}
				<div class="bg-white dark:bg-slate-900 rounded-xl shadow-sm dark:shadow-lg border border-slate-200 dark:border-slate-700/50 p-6 mb-6 hover:shadow-lg transition-shadow duration-300 animate-scale-in">
					<h2 class="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
						<Plus class="w-6 h-6 text-blue-600 dark:text-blue-400" />
						Invită un Medic
					</h2>
					<form onsubmit={(e) => { e.preventDefault(); sendInvite(); }} class="flex gap-3">
						<input
							type="email"
							bind:value={medicEmail}
							placeholder="Email medic (ex: medic@test.com)"
							class="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:scale-[1.01] transition-all duration-200"
							required
						/>
						<button
							type="submit"
							disabled={sending || !medicEmail.trim()}
							class="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 hover:shadow-lg hover:shadow-blue-500/50 hover:scale-105 active:scale-95 font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all duration-200 min-w-[160px]"
						>
							{#if sending}
								<span class="flex items-center justify-center gap-2">
									<LoaderCircle class="h-5 w-5 animate-spin" />
									Se trimite...
								</span>
							{:else}
								<span class="flex items-center justify-center gap-2">
									<Mail class="w-5 h-5" />
									Trimite Invitația
								</span>
							{/if}
						</button>
					</form>
				</div>
			{/if}

			<!-- Pending Invites -->
			{#if pendingInvites.length > 0}
			<div class="bg-white dark:bg-slate-900 rounded-xl shadow-sm dark:shadow-lg border border-slate-200 dark:border-slate-700/50 overflow-hidden mb-6 animate-scale-in">
				<div class="p-6 border-b border-gray-100 dark:border-slate-700 bg-gradient-to-r from-yellow-50 to-white dark:from-slate-800/50 dark:to-slate-900">
					<h2 class="text-xl font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
						<Clock class="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
						Invitații în Așteptare
					</h2>
				</div>
				<div class="divide-y divide-gray-100 dark:divide-slate-700">
					{#each pendingInvites as invite}
						<div class="flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors duration-200">
								<div class="flex items-center gap-4">
									<div class="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
										{$isMedic ? (invite.pacientName?.charAt(0).toUpperCase() || '?') : (invite.medicName?.charAt(0).toUpperCase() || '?')}
									</div>
								<div>
										<p class="font-semibold text-gray-900 dark:text-slate-100">{$isMedic ? invite.pacientName : invite.medicName}</p>
														<p class="text-sm text-gray-700 dark:text-slate-300">{$isMedic ? invite.pacientEmail : invite.medicEmail}</p>
														<p class="text-xs text-gray-600 dark:text-slate-400 mt-1 flex items-center gap-1">
															<CalendarDays class="w-3 h-3" />
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
												<LoaderCircle class="h-4 w-4 animate-spin" />
											</span>
										{:else}
											<span class="inline-flex items-center gap-2">
												<Check class="w-4 h-4" />
												Acceptă
											</span>
										{/if}
									</button>
									<button
										onclick={() => respondToInvite(invite.id, 'reject')}
										disabled={respondingToInvite === invite.id}
										class="px-5 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/50 hover:scale-105 active:scale-95 font-medium shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
									>
										{#if respondingToInvite === invite.id}
											<span class="flex items-center justify-center gap-1">
												<LoaderCircle class="h-4 w-4 animate-spin" />
											</span>
										{:else}
											<span class="inline-flex items-center gap-2">
												<X class="w-4 h-4" />
												Refuză
											</span>
										{/if}
									</button>
								</div>
							{:else}
								<span class="text-sm px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-lg font-medium flex items-center gap-2">
									<Clock class="w-4 h-4 animate-pulse" />
									În așteptare...
								</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Active Collaborations -->
		<div class="bg-white dark:bg-slate-900 rounded-xl shadow-sm dark:shadow-lg border border-slate-200 dark:border-slate-700/50 overflow-hidden animate-scale-in">
			<div class="p-6 border-b border-gray-100 dark:border-slate-700 bg-gradient-to-r from-green-50 to-white dark:from-slate-800/50 dark:to-slate-900">
				<h2 class="text-xl font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
					<CheckCircle2 class="w-6 h-6 text-green-600 dark:text-green-400" />
					Colaborări Active
				</h2>
			</div>
				
				{#if loading}
					<div class="flex justify-center py-12">
						<div class="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent shadow-lg shadow-blue-500/50"></div>
					</div>
				{:else if collaborations.length === 0}
					<div class="p-12 text-center">
						<Users class="w-16 h-16 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
						<p class="text-gray-700 dark:text-slate-300">Nicio colaborare activă încă</p>
					</div>
				{:else}
					<div class="grid gap-5 md:grid-cols-2 p-6">
						{#each collaborations as collab}
							<div class="border-2 border-gray-200 dark:border-slate-700 dark:bg-slate-800/50 rounded-xl p-5 hover:border-green-300 dark:hover:border-green-600 hover:shadow-xl hover:shadow-green-500/10 hover:-translate-y-1 transition-all duration-300 group animate-scale-in">
								<div class="flex items-center gap-4 mb-4">
									<div class="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md group-hover:scale-110 transition-transform duration-300">
										{$isMedic ? (collab.pacientName?.charAt(0).toUpperCase() || '?') : (collab.medicName?.charAt(0).toUpperCase() || '?')}
									</div>
									<div class="flex-1">
									<h3 class="font-semibold text-gray-900 dark:text-slate-100 text-lg">{$isMedic ? collab.pacientName : collab.medicName}</h3>
														<p class="text-sm text-gray-700 dark:text-slate-300">{$isMedic ? collab.pacientEmail : collab.medicEmail}</p>
														<p class="text-xs text-gray-600 dark:text-slate-400 mt-1 flex items-center gap-1">
															<CalendarDays class="w-3 h-3" />
															Din {new Date(collab.created_at).toLocaleDateString('ro-RO')}
														</p>
									</div>
								</div>
								<div class="flex gap-3">
										<button
											onclick={() => goto(`/chat/${$isMedic ? collab.patientId : collab.doctorId}`)}
											class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/50 hover:scale-105 active:scale-95 text-sm font-medium shadow-sm transition-all duration-200 flex items-center justify-center gap-2"
										>
											<MessageCircle class="w-4 h-4" />
											Mesaj
										</button>
									{#if $isMedic}
											<button
												onclick={() => goto(`/treatments?createNew=true&pacientId=${collab.patientId}`)}
												class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 hover:shadow-lg hover:shadow-green-500/50 hover:scale-105 active:scale-95 text-sm font-medium shadow-sm transition-all duration-200 flex items-center justify-center gap-2"
											>
												<ClipboardList class="w-4 h-4" />
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
