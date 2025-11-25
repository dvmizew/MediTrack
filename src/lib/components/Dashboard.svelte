<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/api/client';
	import { authStore, isPacient } from '$lib/stores/auth';

	let todayMedications = $state<any[]>([]);
	let loading = $state(true);

	onMount(async () => {
		await loadMedications();
	});

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
			await loadMedications();
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

<div class="space-y-6">
	<!-- Stats Card -->
		<div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
			<div class="flex justify-between items-start">
				<div>
					<h2 class="text-2xl font-bold mb-3">Bine ai revenit!</h2>
					<div class="space-y-1">
						<p class="text-blue-100 flex items-center gap-2">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
							</svg>
							<span class="font-semibold">{$authStore.user.totalXp || 0} XP</span>
						</p>
						<p class="text-blue-100 flex items-center gap-2">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/>
							</svg>
							<span class="font-semibold">{$authStore.user.currentStreak || 0}</span> zile consecutive
						</p>
						<p class="text-blue-100 flex items-center gap-2">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
							</svg>
							Record: <span class="font-semibold">{$authStore.user.longestStreak || 0}</span> zile
						</p>
					</div>
				</div>
				{#if $authStore.user.currentBadge}
					<div class="text-center">
						<div class={`px-4 py-2 rounded-xl ${getBadgeColor($authStore.user.currentBadge)} shadow-lg`}>
							<p class="text-sm font-bold uppercase tracking-wide">{$authStore.user.currentBadge}</p>
						</div>
					</div>
				{/if}
			</div>
		</div>

	<!-- Today's Medications -->
	{#if $isPacient}
		<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
			<div class="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
				<h3 class="text-lg font-semibold text-gray-900">📋 Medicamentele de astăzi</h3>
			</div>

			{#if loading}
				<div class="flex justify-center py-12">
					<div class="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent"></div>
				</div>
			{:else if todayMedications.length === 0}
				<div class="p-12 text-center">
					<svg class="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
					</svg>
					<p class="text-gray-500">Nu ai medicamente programate astăzi</p>
				</div>
			{:else}
				<div class="divide-y divide-gray-100">
					{#each todayMedications as medication}
						<div class="p-5 hover:bg-gray-50 transition" class:bg-green-50={medication.is_taken}>
							<div class="flex justify-between items-start gap-4">
								<div class="flex-1">
									<h4 class="font-semibold text-gray-900 mb-1">{medication.medication_name}</h4>
									<div class="space-y-1">
										<p class="text-sm text-gray-600">💊 Doza: <span class="font-medium">{medication.dosage}</span></p>
										<p class="text-sm text-gray-600">🔄 Frecvență: <span class="font-medium">{medication.frequency}</span></p>
										{#if medication.instructions}
											<p class="text-sm text-gray-500 mt-2 italic">{medication.instructions}</p>
										{/if}
									</div>
								</div>

								<div class="flex flex-col gap-2">
									{#if medication.is_taken}
										<span class="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2">
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
											</svg>
											Luat
										</span>
									{:else if medication.snoozed_until && new Date(medication.snoozed_until) > new Date()}
										<span class="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm font-medium flex items-center gap-2">
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
											</svg>
											Amânat
										</span>
									{:else}
										<button
											onclick={() => confirmMedication(medication)}
											class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm transition"
										>
											✓ Confirmă
										</button>
										<button
											onclick={() => snoozeMedication(medication)}
											class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition"
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
	<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
		{#if $isPacient}
			<a
				href="/collaborations"
				class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg hover:border-blue-300 transition group"
			>
				<div class="flex items-start gap-4">
					<div class="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition">
						<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
							/>
						</svg>
					</div>
					<div>
						<h4 class="font-semibold text-gray-900">Medicii mei</h4>
						<p class="text-sm text-gray-600">Gestionează colaborările</p>
					</div>
				</div>
			</a>
		{/if}

		<a
			href="/treatments"
			class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg hover:border-green-300 transition group"
		>
			<div class="flex items-start gap-4">
				<div class="p-3 bg-green-100 rounded-xl group-hover:bg-green-200 transition">
					<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
						/>
					</svg>
				</div>
				<div>
					<h4 class="font-semibold text-gray-900">Tratamente</h4>
					<p class="text-sm text-gray-600">Vezi planurile tale</p>
				</div>
			</div>
		</a>

		<a
			href="/chat"
			class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
		>
			<div class="flex items-center gap-3">
				<div class="p-3 bg-purple-100 rounded-lg">
					<svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
						/>
					</svg>
				</div>
				<div>
					<h4 class="font-semibold text-gray-900">Mesaje</h4>
					<p class="text-sm text-gray-600">Chat cu medicul</p>
				</div>
			</div>
		</a>
	</div>
</div>
