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
	<div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
		<Header />
		<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<div class="mb-8">
				<h1 class="text-3xl font-bold text-gray-900 mb-2">🤝 Colaborări</h1>
				<p class="text-gray-600">
					{#if $isMedic}
						Gestionează colaborările cu pacienții tăi
					{:else}
						Gestionează colaborările cu medicii tăi
					{/if}
				</p>
			</div>

			{#if error}
				<div class="bg-red-50 border-2 border-red-200 rounded-xl p-6 mb-6 flex items-start gap-3">
					<svg class="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
					</svg>
					<p class="text-red-800 font-medium">{error}</p>
				</div>
			{/if}

			<!-- Send Invite Form (Pacient only) -->
			{#if $isPacient}
				<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
					<h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
						<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
						</svg>
						Invită un Medic
					</h2>
					<form onsubmit={(e) => { e.preventDefault(); sendInvite(); }} class="flex gap-3">
						<input
							type="email"
							bind:value={medicEmail}
							placeholder="Email medic (ex: medic@test.com)"
							class="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
							required
						/>
						<button
							type="submit"
							disabled={sending || !medicEmail.trim()}
							class="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition"
						>
							{sending ? 'Se trimite...' : 'Trimite Invitația'}
						</button>
					</form>
				</div>
			{/if}

			<!-- Pending Invites -->
			{#if pendingInvites.length > 0}
				<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
					<div class="p-6 border-b border-gray-100 bg-gradient-to-r from-yellow-50 to-white">
						<h2 class="text-xl font-semibold text-gray-900 flex items-center gap-2">
							<svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
							</svg>
							Invitații în Așteptare
						</h2>
					</div>
					<div class="divide-y divide-gray-100">
						{#each pendingInvites as invite}
							<div class="flex items-center justify-between p-5 hover:bg-gray-50 transition">
								<div class="flex items-center gap-4">
									<div class="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
										{invite.name?.charAt(0).toUpperCase() || '?'}
									</div>
									<div>
										<p class="font-semibold text-gray-900">{invite.name}</p>
										<p class="text-sm text-gray-500">{invite.email}</p>
										<p class="text-xs text-gray-400 mt-1 flex items-center gap-1">
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
											class="px-5 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium shadow-sm transition"
										>
											✓ Acceptă
										</button>
										<button
											onclick={() => respondToInvite(invite.id, 'reject')}
											class="px-5 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium shadow-sm transition"
										>
											✕ Refuză
										</button>
									</div>
								{:else}
									<span class="text-sm text-gray-600">În așteptare...</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Active Collaborations -->
			<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
				<div class="p-6 border-b border-gray-100 bg-gradient-to-r from-green-50 to-white">
					<h2 class="text-xl font-semibold text-gray-900 flex items-center gap-2">
						<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
						</svg>
						Colaborări Active
					</h2>
				</div>
				
				{#if loading}
					<div class="flex justify-center py-12">
						<div class="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent"></div>
					</div>
				{:else if collaborations.length === 0}
					<div class="p-12 text-center">
						<svg class="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
						</svg>
						<p class="text-gray-500">Nicio colaborare activă încă</p>
					</div>
				{:else}
					<div class="grid gap-5 md:grid-cols-2 p-6">
						{#each collaborations as collab}
							<div class="border-2 border-gray-200 rounded-xl p-5 hover:border-green-300 hover:shadow-lg transition group">
								<div class="flex items-center gap-4 mb-4">
									<div class="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md">
										{collab.name?.charAt(0).toUpperCase() || '?'}
									</div>
									<div class="flex-1">
										<h3 class="font-semibold text-gray-900 text-lg">{collab.name}</h3>
										<p class="text-sm text-gray-500">{collab.email}</p>
										<p class="text-xs text-gray-400 mt-1 flex items-center gap-1">
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
										class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium shadow-sm transition flex items-center justify-center gap-2"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
										</svg>
										Mesaj
									</button>
									{#if $isMedic}
										<button
											onclick={() => goto(`/treatments/new?pacientId=${collab.user_id}`)}
											class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium shadow-sm transition flex items-center justify-center gap-2"
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
