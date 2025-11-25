<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { api } from '$lib/api/client';
	import { authStore, isPacient } from '$lib/stores/auth';

	let todayMedications = $state<any[]>([]);
	let loading = $state(true);
	let refreshInterval: ReturnType<typeof setInterval> | null = null;

	onMount(async () => {
		await loadMedications();
		
		// Auto-refresh every 60 seconds
		refreshInterval = setInterval(() => {
			loadMedications();
		}, 60000);
		
		// Listen for real-time notifications
		window.addEventListener('notification', handleNotification as EventListener);
		window.addEventListener('new-message', handleNotification as EventListener);
	});

	onDestroy(() => {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
		window.removeEventListener('notification', handleNotification as EventListener);
		window.removeEventListener('new-message', handleNotification as EventListener);
	});

	function handleNotification(event: CustomEvent) {
		const detail = event.detail;
		// Refresh on medication-related notifications
		if (detail?.type === 'reminder' || detail?.type === 'treatment_update' || detail?.type === 'alert') {
			loadMedications();
			// Also refresh user stats
			refreshUserStats();
		}
	}

	async function refreshUserStats() {
		try {
			const user = await api.getProfile();
			authStore.updateUser(user);
		} catch (error) {
			console.error('Failed to refresh user stats:', error);
		}
	}

	async function loadMedications() {
		try {
			const data = await api.getTodayMedications();
			todayMedications = data;
		} catch (error) {
			console.error('Failed to load medications:', error);
		} finally {
			loading = false;
		}
	}

	async function confirmMedication(medication: any) {
		try {
			await api.confirmMedication({
				medicationScheduleId: medication.id,
				scheduledTime: new Date().toISOString()
			});
			// Immediate refresh after confirmation
			await loadMedications();
			await refreshUserStats();
		} catch (error) {
			console.error('Failed to confirm medication:', error);
		}
	}

	async function snoozeMedication(medication: any) {
		try {
			await api.snoozeMedication({
				medicationScheduleId: medication.id,
				scheduledTime: new Date().toISOString()
			});
			// Immediate refresh after snooze
			await loadMedications();
		} catch (error) {
			console.error('Failed to snooze medication:', error);
		}
	}

	function getBadgeColor(badge: string) {
		const colors: Record<string, string> = {
			bronze: 'bg-orange-700 text-white',
			silver: 'bg-gray-400 text-white',
			gold: 'bg-yellow-500 text-white',
			platinum: 'bg-blue-400 text-white',
			diamond: 'bg-purple-600 text-white'
		};
		return colors[badge] || 'bg-gray-300 text-gray-700';
	}
</script>

<div class="space-y-4 md:space-y-6">
	<!-- Stats Card -->
		<div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 md:p-6 text-white shadow-lg">
			<div class="flex flex-col sm:flex-row justify-between items-start gap-4">
				<div class="w-full sm:flex-1">
					<h2 class="text-xl md:text-2xl font-bold mb-3">Bine ai revenit!</h2>
					<div class="space-y-1 text-sm md:text-base">
						<p class="text-blue-100 flex items-center gap-2">
							<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
							</svg>
							<span class="font-semibold">{$authStore.user.totalXp || 0} XP</span>
						</p>
						<p class="text-blue-100 flex items-center gap-2">
							<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/>
							</svg>
							<span class="font-semibold">{$authStore.user.currentStreak || 0}</span> zile consecutive
						</p>
						<p class="text-blue-100 flex items-center gap-2">
							<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
							</svg>
							Record: <span class="font-semibold">{$authStore.user.longestStreak || 0}</span> zile
						</p>
					</div>
				</div>
				{#if $authStore.user.currentBadge}
					<div class="text-center sm:text-right">
						<div class={`px-3 py-2 md:px-4 md:py-2 rounded-xl ${getBadgeColor($authStore.user.currentBadge)} shadow-lg inline-block`}>
							<p class="text-xs md:text-sm font-bold uppercase tracking-wide">{$authStore.user.currentBadge}</p>
						</div>
					</div>
				{/if}
			</div>
		</div>

	<!-- Today's Medications -->
	{#if $isPacient}
		<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
			<div class="p-4 md:p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
				<h3 class="text-base md:text-lg font-semibold text-gray-900">📋 Medicamentele de astăzi</h3>
			</div>

			{#if loading}
				<div class="flex justify-center py-8 md:py-12">
					<div class="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent"></div>
				</div>
			{:else if todayMedications.length === 0}
				<div class="p-8 md:p-12 text-center">
					<svg class="w-12 h-12 md:w-16 md:h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
					</svg>
					<p class="text-sm md:text-base text-gray-500">Nu ai medicamente programate astăzi</p>
				</div>
			{:else}
				<div class="divide-y divide-gray-100">
					{#each todayMedications as medication}
						<div class="p-4 md:p-5 hover:bg-gray-50 transition" class:bg-green-50={medication.is_taken}>
							<div class="flex flex-col sm:flex-row justify-between items-start gap-3 md:gap-4">
								<div class="flex-1 min-w-0 w-full">
									<h4 class="font-semibold text-gray-900 mb-1 text-sm md:text-base">{medication.medication_name}</h4>
									<div class="space-y-1">
										<p class="text-xs md:text-sm text-gray-600">💊 Doza: <span class="font-medium">{medication.dosage}</span></p>
										<p class="text-xs md:text-sm text-gray-600">🔄 Frecvență: <span class="font-medium">{medication.frequency}</span></p>
										{#if medication.instructions}
											<p class="text-xs md:text-sm text-gray-500 mt-2 italic line-clamp-2">{medication.instructions}</p>
										{/if}
									</div>
								</div>

								<div class="flex sm:flex-col gap-2 w-full sm:w-auto">
									{#if medication.is_taken}
										<span class="px-3 py-2 md:px-4 md:py-2 bg-green-500 text-white rounded-lg text-xs md:text-sm font-semibold shadow-sm flex items-center justify-center gap-2 whitespace-nowrap">
											<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
											</svg>
											Luat
										</span>
									{:else if medication.snoozed_until && new Date(medication.snoozed_until) > new Date()}
										<span class="px-3 py-2 md:px-4 md:py-2 bg-yellow-100 text-yellow-800 rounded-lg text-xs md:text-sm font-medium flex items-center justify-center gap-2 whitespace-nowrap">
											<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
											</svg>
											Amânat
										</span>
									{:else}
										<button
											onclick={() => confirmMedication(medication)}
											class="flex-1 sm:flex-none px-3 py-2 md:px-4 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 text-xs md:text-sm font-medium shadow-sm transition touch-manipulation"
										>
											✓ Confirmă
										</button>
										<button
											onclick={() => snoozeMedication(medication)}
											class="flex-1 sm:flex-none px-3 py-2 md:px-4 md:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 text-xs md:text-sm font-medium transition touch-manipulation"
										>
											⏰ +30min
										</button>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Quick Actions -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
		{#if $isPacient}
			<a
				href="/collaborations"
				class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 hover:shadow-lg hover:border-blue-300 transition group active:scale-95 touch-manipulation"
			>
				<div class="flex items-start gap-3 md:gap-4">
					<div class="p-2 md:p-3 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition flex-shrink-0">
						<svg class="w-5 h-5 md:w-6 md:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
							/>
						</svg>
					</div>
					<div class="min-w-0">
						<h4 class="font-semibold text-gray-900 text-sm md:text-base">Medicii mei</h4>
						<p class="text-xs md:text-sm text-gray-600">Gestionează colaborările</p>
					</div>
				</div>
			</a>
		{/if}

		<a
			href="/treatments"
			class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 hover:shadow-lg hover:border-green-300 transition group active:scale-95 touch-manipulation"
		>
			<div class="flex items-start gap-3 md:gap-4">
				<div class="p-2 md:p-3 bg-green-100 rounded-xl group-hover:bg-green-200 transition flex-shrink-0">
					<svg class="w-5 h-5 md:w-6 md:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
						/>
					</svg>
				</div>
				<div class="min-w-0">
					<h4 class="font-semibold text-gray-900 text-sm md:text-base">Tratamente</h4>
					<p class="text-xs md:text-sm text-gray-600">Vezi planurile tale</p>
				</div>
			</div>
		</a>

		<a
			href="/chat"
			class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 hover:shadow-lg hover:border-purple-300 transition group active:scale-95 touch-manipulation"
		>
			<div class="flex items-start gap-3 md:gap-4">
				<div class="p-2 md:p-3 bg-purple-100 rounded-xl group-hover:bg-purple-200 transition flex-shrink-0">
					<svg class="w-5 h-5 md:w-6 md:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
						/>
					</svg>
				</div>
				<div class="min-w-0">
					<h4 class="font-semibold text-gray-900 text-sm md:text-base">Mesaje</h4>
					<p class="text-xs md:text-sm text-gray-600">Chat cu medicul</p>
				</div>
			</div>
		</a>
	</div>
</div>
