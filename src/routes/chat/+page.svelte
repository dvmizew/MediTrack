<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import { scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

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
	<main class="fixed inset-0 flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
		<!-- Header - Chat Style -->
		<div class="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700 shadow-lg flex-shrink-0 z-10">
			<div class="w-full px-3 sm:px-4 md:px-6">
				<div class="flex items-center justify-between h-16 sm:h-18">
					<button 
						onclick={() => goto('/dashboard')}
						class="flex items-center gap-3 hover:bg-white/10 dark:hover:bg-black/20 rounded-xl p-2 -ml-2 transition-all duration-200"
					>
						<!-- Back arrow -->
						<svg class="w-6 h-6 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/>
						</svg>
						
						<div class="text-left">
							<h1 class="text-lg sm:text-xl font-bold text-white drop-shadow-sm">💬 Mesaje</h1>
							<p class="text-xs text-white/80 hidden sm:block">Conversațiile tale</p>
						</div>
					</button>
				</div>
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6">
			<div class="max-w-4xl mx-auto">
			{#if loading}
				<div class="flex justify-center py-12 sm:py-20">
					<div class="animate-spin rounded-full h-10 w-10 sm:h-14 sm:w-14 border-3 sm:border-4 border-blue-600 border-t-transparent shadow-lg shadow-blue-500/50"></div>
				</div>
			{:else if error}
				<div class="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-4 sm:p-6 flex items-start gap-3 animate-shake">
					<svg class="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
					</svg>
					<p class="text-red-800 dark:text-red-400 font-medium">{error}</p>
				</div>
			{:else if collaborations.length === 0}
				<div class="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 sm:p-12 md:p-16 text-center animate-scale-in">
					<div class="max-w-sm mx-auto">
						<svg
							class="mx-auto h-16 w-16 sm:h-20 sm:w-20 text-gray-300 dark:text-gray-600 mb-3 sm:mb-4"
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
						<h3 class="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Nicio colaborare activă</h3>
						<p class="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-4 sm:mb-6 px-4">
							Pentru a trimite mesaje, trebuie să ai cel puțin o colaborare acceptată
						</p>
						<button
							onclick={() => goto('/collaborations')}
							class="px-5 py-2.5 sm:px-6 sm:py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 hover:shadow-2xl hover:shadow-blue-500/50 active:scale-95 sm:hover:scale-110 font-medium shadow-lg transition-all duration-300 ease-in-out touch-manipulation text-sm sm:text-base"
						>
							Vezi Colaborările
						</button>
					</div>
				</div>
			{:else}
				<div class="grid gap-3 sm:gap-4 md:gap-5">
					{#each collaborations as collab}
						<button
							onclick={() => goto(`/chat/${collab.user_id}`)}
							class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-gray-200 dark:border-gray-700 p-4 sm:p-5 md:p-6 hover:shadow-xl hover:shadow-blue-500/10 active:border-blue-300 dark:active:border-blue-600 sm:hover:border-blue-300 sm:dark:hover:border-blue-600 sm:hover:-translate-y-1 transition-all duration-300 text-left group animate-scale-in touch-manipulation"
						>
							<div class="flex items-center justify-between gap-2 sm:gap-4">
								<div class="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
									<!-- Avatar with online status indicator -->
									<div class="relative flex-shrink-0">
										<div class="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg sm:text-xl shadow-md sm:group-hover:scale-110 transition-transform duration-300">
											{collab.name?.charAt(0).toUpperCase() || '?'}
										</div>
										<!-- Online status indicator -->
										<div class="absolute bottom-0 right-0 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
									</div>
									
									<div class="min-w-0 flex-1">
										<!-- Name with role badge -->
										<div class="flex items-center gap-2 mb-0.5">
											<h3 class="font-semibold text-gray-900 dark:text-gray-100 text-base sm:text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition truncate">
												{collab.name}
											</h3>
											<span class="px-1.5 py-0.5 text-[10px] font-medium rounded flex-shrink-0 {collab.role === 'medic' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}">
												{collab.role === 'medic' ? '⚕️ Doctor' : '🧑 Pacient'}
											</span>
										</div>
										<!-- Email or last message preview -->
										<p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
											{collab.email}
										</p>
									</div>
								</div>
								
								<!-- Arrow icon -->
								<svg class="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 sm:group-hover:translate-x-1 transition-all duration-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
								</svg>
							</div>
						</button>
					{/each}
				</div>
			{/if}
			</div>
		</div>
	</main>
{/if}