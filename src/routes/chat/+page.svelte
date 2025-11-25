<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import Header from '$lib/components/Header.svelte';

	let collaborations = $state<any[]>([]);
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		if (!$authStore.isAuthenticated) {
			goto('/');
			return;
		}
		await loadCollaborations();
	});

	async function loadCollaborations() {
		try {
			loading = true;
			error = '';
			const data = await api.getMyCollaborations();
			collaborations = data;
		} catch (err: any) {
			console.error('Failed to load collaborations:', err);
			error = err.message || 'Nu s-au putut încărca colaborările';
		} finally {
			loading = false;
		}
	}
</script>

{#if $authStore.isAuthenticated}
	<div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
		<Header />
		<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<div class="mb-8">
				<h1 class="text-3xl font-bold text-gray-900 mb-2">💬 Mesaje</h1>
				<p class="text-gray-600">Comunică cu medicii și pacienții tăi</p>
			</div>

			{#if loading}
				<div class="flex justify-center py-20">
					<div class="animate-spin rounded-full h-14 w-14 border-4 border-blue-600 border-t-transparent"></div>
				</div>
			{:else if error}
				<div class="bg-red-50 border-2 border-red-200 rounded-xl p-6 flex items-start gap-3">
					<svg class="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
					</svg>
					<p class="text-red-800 font-medium">{error}</p>
				</div>
			{:else if collaborations.length === 0}
				<div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-16 text-center">
					<div class="max-w-sm mx-auto">
						<svg
							class="mx-auto h-20 w-20 text-gray-300 mb-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
							/>
						</svg>
						<h3 class="text-xl font-semibold text-gray-900 mb-2">Nicio colaborare activă</h3>
						<p class="text-gray-500 mb-6">
							Pentru a trimite mesaje, trebuie să ai cel puțin o colaborare acceptată
						</p>
						<button
							onclick={() => goto('/collaborations')}
							class="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-lg transition"
						>
							Vezi Colaborările
						</button>
					</div>
				</div>
			{:else}
				<div class="grid gap-5">
					{#each collaborations as collab}
						<button
							onclick={() => goto(`/chat/${collab.user_id}`)}
							class="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-6 hover:shadow-lg hover:border-blue-300 transition text-left group"
						>
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-4">
									<div class="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md">
										{collab.name?.charAt(0).toUpperCase() || '?'}
									</div>
									<div>
										<h3 class="font-semibold text-gray-900 text-lg group-hover:text-blue-600 transition">{collab.name}</h3>
										<p class="text-sm text-gray-500">{collab.email}</p>
									</div>
								</div>
								<svg class="w-6 h-6 text-gray-400 group-hover:text-blue-600 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
								</svg>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</main>
	</div>
{/if}
