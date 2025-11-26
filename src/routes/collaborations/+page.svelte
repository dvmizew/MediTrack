<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore, isMedic, isPacient } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import Header from '$lib/components/Header.svelte';

	let collaborations = $state<any[]>([]);
	let pendingInvites = $state<any[]>([]);
	let loading = $state(true);
	let error = $state('');
	let medicEmail = $state('');
	let sending = $state(false);

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
			const [collabData, pendingData] = await Promise.all([
				api.getMyCollaborations(),
				api.getPendingInvites()
			]);
			collaborations = collabData;
			pendingInvites = pendingData;
		} catch (err: any) {
			console.error('Failed to load data:', err);
			error = err.message || 'Nu s-au putut încărca datele';
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
			medicEmail = '';
			await loadData();
		} catch (err: any) {
			console.error('Failed to send invite:', err);
			error = err.message || 'Nu s-a putut trimite invitația';
		} finally {
			sending = false;
		}
	}

	async function respondToInvite(inviteId: number, action: 'accept' | 'reject') {
		try {
			error = '';
			await api.respondToInvite(inviteId, action);
			await loadData();
		} catch (err: any) {
			console.error('Failed to respond to invite:', err);
			error = err.message || 'Nu s-a putut răspunde la invitație';
		}
	}
</script>

{#if $authStore.isAuthenticated}
	<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
		<Header />
		<main class="page-transition max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<div class="mb-8">
				<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">🤝 Colaborări</h1>
				<p class="text-gray-600 dark:text-gray-400">
					{#if $isMedic}
						Gestionează colaborările cu pacienții tăi
					{:else}
						Gestionează colaborările cu medicii tăi
					{/if}
				</p>
			</div>

			{#if error}
				<div class="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-6 mb-6 flex items-start gap-3 animate-shake">
					<svg class="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
					</svg>
					<p class="text-red-800 dark:text-red-400 font-medium">{error}</p>
				</div>
			{/if}

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
							class="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 hover:shadow-lg hover:shadow-blue-500/50 hover:scale-105 active:scale-95 font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all duration-200"
						>
							{sending ? 'Se trimite...' : 'Trimite Invitația'}
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
										{invite.name?.charAt(0).toUpperCase() || '?'}
									</div>
								<div>
									<p class="font-semibold text-gray-900 dark:text-gray-100">{invite.name}</p>
									<p class="text-sm text-gray-500 dark:text-gray-400">{invite.email}</p>
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
										class="px-5 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 hover:shadow-lg hover:shadow-green-500/50 hover:scale-105 active:scale-95 font-medium shadow-sm transition-all duration-200"
									>
										✓ Acceptă
									</button>
									<button
										onclick={() => respondToInvite(invite.id, 'reject')}
										class="px-5 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/50 hover:scale-105 active:scale-95 font-medium shadow-sm transition-all duration-200"
									>
										✕ Refuză
									</button>
								</div>
							{:else}
								<span class="text-sm text-gray-600 dark:text-gray-400">În aşteptare...</span>
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
										{collab.name?.charAt(0).toUpperCase() || '?'}
									</div>
									<div class="flex-1">
										<h3 class="font-semibold text-gray-900 dark:text-gray-100 text-lg">{collab.name}</h3>
										<p class="text-sm text-gray-500 dark:text-gray-400">{collab.email}</p>
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
										onclick={() => goto(`/chat/${collab.user_id}`)}
										class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/50 hover:scale-105 active:scale-95 text-sm font-medium shadow-sm transition-all duration-200 flex items-center justify-center gap-2"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
										</svg>
										Mesaj
									</button>
									{#if $isMedic}
										<button
											onclick={() => goto(`/treatments/new?pacientId=${collab.user_id}`)}
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
		</main>
	</div>
{/if}
