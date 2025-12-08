<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Chart } from 'chart.js/auto';
	import { api } from '$lib/api/client';
	import { authStore, isPacient, isMedic } from '$lib/stores/auth';
	import { themeStore } from '$lib/stores/theme';

	let todayMedications = $state<any[]>([]);
	let adherenceHistory = $state<any[]>([]);
	let loading = $state(true);
	let refreshInterval: ReturnType<typeof setInterval> | null = null;
	let themeUnsubscribe: (() => void) | null = null;
	let stats = $state({
		total: 0,
		taken: 0,
		overdue: 0,
		snoozed: 0,
		upcomingLabel: '—',
		adherence: 0
	});
	
	// Chart references
	let adherenceChartCanvas: HTMLCanvasElement;
	let adherenceChart: Chart | null = null;
	let weeklyChartCanvas: HTMLCanvasElement;
	let weeklyChart: Chart | null = null;
	let medicationsChartCanvas: HTMLCanvasElement;
	let medicationsChart: Chart | null = null;

	onMount(async () => {
		await loadMedications();
		initializeCharts();
		
		// Auto-refresh every 60 seconds
		refreshInterval = setInterval(() => {
			loadMedications();
			updateCharts();
		}, 60000);
		
		// Listen for real-time notifications
		window.addEventListener('notification', handleNotification as EventListener);
		window.addEventListener('new-message', handleNotification as EventListener);
		
		// Listen for theme changes
		themeUnsubscribe = themeStore.subscribe(() => {
			// Recreate charts with new theme colors
			if (adherenceChart) adherenceChart.destroy();
			if (weeklyChart) weeklyChart.destroy();
			if (medicationsChart) medicationsChart.destroy();
			initializeCharts();
		});
	});

	onDestroy(() => {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
		if (themeUnsubscribe) {
			themeUnsubscribe();
		}
		if (adherenceChart) adherenceChart.destroy();
		if (weeklyChart) weeklyChart.destroy();
		if (medicationsChart) medicationsChart.destroy();
		window.removeEventListener('notification', handleNotification as EventListener);
		window.removeEventListener('new-message', handleNotification as EventListener);
	});

	function handleNotification(event: CustomEvent) {
		const detail = event.detail;
		if (detail?.type === 'reminder' || detail?.type === 'treatment_update' || detail?.type === 'alert') {
			loadMedications();
			refreshUserStats();
			updateCharts();
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
			updateStats();
			
			// Load historical adherence data
			const history = await api.getMedicationHistoryAdherence(7);
			adherenceHistory = history.sort((a: any, b: any) => 
				new Date(a.date).getTime() - new Date(b.date).getTime()
			);
			
			updateCharts();
		} catch (error) {
			console.error('Failed to load medications:', error);
		} finally {
			loading = false;
		}
	}

	function updateStats() {
		const now = new Date();
		const total = todayMedications.length;
		const taken = todayMedications.filter((m) => m.is_taken).length;
		const overdue = todayMedications.filter(
			(m) => !m.is_taken && m.scheduled_time && new Date(m.scheduled_time) < now
		).length;
		const snoozed = todayMedications.filter(
			(m) => !m.is_taken && m.snoozed_until && new Date(m.snoozed_until) > now
		).length;

		const upcoming = todayMedications
			.filter((m) => !m.is_taken && m.scheduled_time && new Date(m.scheduled_time) >= now)
			.sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time))[0];

		stats = {
			total,
			taken,
			overdue,
			snoozed,
			upcomingLabel: upcoming
				? `${new Date(upcoming.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${
						upcoming.medication_name || 'Doză următoare'
				  }`
				: 'Nicio doză programată',
			adherence: total ? Math.round((taken / total) * 100) : 0
		};
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

	function getTimeLabel(dateString: string) {
		return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function buildTodayTimeline() {
		// Use historical 7-day data if available, otherwise fall back to today's timeline
		if (adherenceHistory.length > 0) {
			return {
				labels: adherenceHistory.map((d: any) => {
					const date = new Date(d.date);
					return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
				}),
				data: adherenceHistory.map((d: any) => d.adherenceRate)
			};
		}

		const sorted = todayMedications
			.filter((m) => m.scheduled_time)
			.map((m) => ({
				label: getTimeLabel(m.scheduled_time),
				when: new Date(m.scheduled_time).getTime(),
				is_taken: m.is_taken
			}))
			.sort((a, b) => a.when - b.when);

		if (sorted.length === 0) {
			return {
				labels: ['—'],
				data: [stats.adherence]
			};
		}

		let takenSoFar = 0;
		const data = sorted.map((entry, idx) => {
			if (entry.is_taken) {
				takenSoFar += 1;
			}
			return Math.round((takenSoFar / (idx + 1)) * 100);
		});

		return {
			labels: sorted.map((entry) => entry.label),
			data
		};
	}

	function getMedicationDistribution() {
		const counts = new Map<string, number>();
		todayMedications.forEach((m) => {
			const name = m.medication_name || 'Fără nume';
			counts.set(name, (counts.get(name) || 0) + 1);
		});

		const labels = counts.size ? Array.from(counts.keys()).slice(0, 6) : ['Nicio medicație'];
		const data = labels.map((label) => counts.get(label) || 0);
		return { labels, data };
	}

	function initializeCharts() {
		const isDark = document.documentElement.classList.contains('dark');
		const textColor = isDark ? '#e5e7eb' : '#374151';
		const gridColor = isDark ? '#374151' : '#e5e7eb';

		// Adherence Rate Chart (Doughnut)
		if (adherenceChartCanvas) {
			const takenCount = todayMedications.filter(m => m.is_taken).length;
			const totalCount = todayMedications.length || 1;
			const adherenceRate = Math.round((takenCount / totalCount) * 100);

			adherenceChart = new Chart(adherenceChartCanvas, {
				type: 'doughnut',
				data: {
					labels: ['Luate', 'Rămase'],
					datasets: [{
						data: [takenCount, totalCount - takenCount],
						backgroundColor: ['#10b981', '#e5e7eb'],
						borderWidth: 0
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							position: 'bottom',
							labels: { color: textColor }
						},
						title: {
							display: true,
							text: `Aderență: ${adherenceRate}%`,
							color: textColor,
							font: { size: 16, weight: 'bold' }
						}
					}
				}
			});
		}

		// Today timeline (Line)
		if (weeklyChartCanvas) {
			const timeline = buildTodayTimeline();

			weeklyChart = new Chart(weeklyChartCanvas, {
				type: 'line',
				data: {
					labels: timeline.labels,
					datasets: [{
						label: 'Aderență cumulată (%)',
						data: timeline.data,
						borderColor: '#3b82f6',
						backgroundColor: 'rgba(59, 130, 246, 0.1)',
						tension: 0.35,
						fill: true
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							labels: { color: textColor }
						}
					},
					scales: {
						y: {
							beginAtZero: true,
							max: 100,
							ticks: { color: textColor },
							grid: { color: gridColor }
						},
						x: {
							ticks: { color: textColor },
							grid: { color: gridColor }
						}
					}
				}
			});
		}

		// Medications Distribution Chart (Bar)
		if (medicationsChartCanvas) {
			const distribution = getMedicationDistribution();

			medicationsChart = new Chart(medicationsChartCanvas, {
				type: 'bar',
				data: {
					labels: distribution.labels,
					datasets: [{
						label: 'Medicamente astăzi',
						data: distribution.data,
						backgroundColor: '#8b5cf6',
						borderRadius: 8
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							display: false
						}
					},
					scales: {
						y: {
							beginAtZero: true,
							ticks: { 
								stepSize: 1,
								color: textColor 
							},
							grid: { color: gridColor }
						},
						x: {
							ticks: { color: textColor },
							grid: { display: false }
						}
					}
				}
			});
		}
	}

	function updateCharts() {
		const isDark = document.documentElement.classList.contains('dark');
		const textColor = isDark ? '#e5e7eb' : '#374151';
		const gridColor = isDark ? '#374151' : '#e5e7eb';
		
		if (adherenceChart) {
			const takenCount = todayMedications.filter(m => m.is_taken).length;
			const totalCount = todayMedications.length || 1;
			const adherenceRate = Math.round((takenCount / totalCount) * 100);
			
			adherenceChart.data.datasets[0].data = [takenCount, totalCount - takenCount];
			if (adherenceChart.options.plugins?.title) {
				adherenceChart.options.plugins.title.text = `Aderență: ${adherenceRate}%`;
				adherenceChart.options.plugins.title.color = textColor;
			}
			if (adherenceChart.options.plugins?.legend?.labels) {
				adherenceChart.options.plugins.legend.labels.color = textColor;
			}
			adherenceChart.update();
		}
		
		if (weeklyChart) {
			const timeline = buildTodayTimeline();
			weeklyChart.data.labels = timeline.labels;
			weeklyChart.data.datasets[0].data = timeline.data;
			if (weeklyChart.options.plugins?.legend?.labels) {
				weeklyChart.options.plugins.legend.labels.color = textColor;
			}
			if (weeklyChart.options.scales?.y) {
				weeklyChart.options.scales.y.ticks = { color: textColor };
				weeklyChart.options.scales.y.grid = { color: gridColor };
			}
			if (weeklyChart.options.scales?.x) {
				weeklyChart.options.scales.x.ticks = { color: textColor };
				weeklyChart.options.scales.x.grid = { color: gridColor };
			}
			weeklyChart.update();
		}
		
		if (medicationsChart) {
			const distribution = getMedicationDistribution();
			medicationsChart.data.labels = distribution.labels;
			medicationsChart.data.datasets[0].data = distribution.data;
			if (medicationsChart.options.scales?.y) {
				medicationsChart.options.scales.y.ticks = { stepSize: 1, color: textColor };
				medicationsChart.options.scales.y.grid = { color: gridColor };
			}
			if (medicationsChart.options.scales?.x) {
				medicationsChart.options.scales.x.ticks = { color: textColor };
				medicationsChart.options.scales.x.grid = { display: false };
			}
			medicationsChart.update();
		}
	}
</script>

<div class="space-y-4 md:space-y-6">
	<!-- Stats Card -->
	<div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 md:p-6 text-white shadow-lg">
		<div class="flex-col sm:flex-row justify-between items-start gap-4">
			<div class="w-full sm:flex-1">
				<h2 class="text-xl md:text-2xl font-bold mb-3">Bine ai revenit, {$authStore.user.fullName}!</h2>
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

	<!-- Quick Stats -->
	<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
		<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 md:p-5 shadow-sm">
			<p class="text-sm text-gray-500 dark:text-gray-400 mb-1">Aderență azi</p>
			<p class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.adherence}%</p>
			<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{stats.taken} din {stats.total} doze</p>
		</div>
		<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 md:p-5 shadow-sm">
			<p class="text-sm text-gray-500 dark:text-gray-400 mb-1">Doze restante</p>
			<p class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{Math.max(stats.total - stats.taken, 0)}</p>
			<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{stats.snoozed} amânate • {stats.overdue} întârziate</p>
		</div>
		<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 md:p-5 shadow-sm">
			<p class="text-sm text-gray-500 dark:text-gray-400 mb-1">Următoarea doză</p>
			<p class="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.upcomingLabel}</p>
			<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Actualizat la {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
		</div>
		<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 md:p-5 shadow-sm">
			<p class="text-sm text-gray-500 dark:text-gray-400 mb-1">Doze confirmate</p>
			<p class="text-2xl md:text-3xl font-bold text-green-600 dark:text-green-400">{stats.taken}</p>
			<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Împreună cu streak-ul tău</p>
		</div>
	</div>

	<!-- Charts Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
		<!-- Adherence Chart -->
		<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">📊 Aderență Astăzi</h3>
			<div class="h-64">
				<canvas bind:this={adherenceChartCanvas}></canvas>
			</div>
		</div>

		<!-- Today timeline Chart -->
		<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">📈 Cronologia dozelor de azi</h3>
			<div class="h-64">
				<canvas bind:this={weeklyChartCanvas}></canvas>
			</div>
		</div>

		<!-- Medications Distribution -->
		<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 lg:col-span-2">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">💊 Medicamentele Tale</h3>
			<div class="h-64">
				<canvas bind:this={medicationsChartCanvas}></canvas>
			</div>
		</div>
	</div>

	<!-- Today's Medications -->
	{#if $isPacient}
		<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
			<div class="p-4 md:p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800">
				<h3 class="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">📋 Medicamentele de astăzi</h3>
			</div>

			{#if loading}
				<div class="flex justify-center py-8 md:py-12">
					<div class="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent shadow-lg shadow-blue-500/50 animate-pulse"></div>
				</div>
			{:else if todayMedications.length === 0}
				<div class="p-8 md:p-12 text-center">
					<svg class="w-12 h-12 md:w-16 md:h-16 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
					</svg>
					<p class="text-sm md:text-base text-gray-500 dark:text-gray-400">Nu ai medicamente programate astăzi</p>
				</div>
			{:else}
				<div class="divide-y divide-gray-100 dark:divide-gray-700">
					{#each todayMedications as medication}
						<div class="p-4 md:p-5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 {medication.is_taken ? 'bg-green-50 dark:bg-green-900/20' : ''}">
							<div class="flex flex-col sm:flex-row justify-between items-start gap-3 md:gap-4">
								<div class="flex-1 min-w-0 w-full">
									<h4 class="font-semibold text-gray-900 dark:text-gray-100 mb-1 text-sm md:text-base">{medication.medication_name}</h4>
									<div class="space-y-1">
										<p class="text-xs md:text-sm text-gray-600 dark:text-gray-400">💊 Doza: <span class="font-medium">{medication.dosage}</span></p>
										<p class="text-xs md:text-sm text-gray-600 dark:text-gray-400">🔄 Frecvență: <span class="font-medium">{medication.frequency}</span></p>
										{#if medication.instructions}
											<p class="text-xs md:text-sm text-gray-500 dark:text-gray-500 mt-2 italic line-clamp-2">{medication.instructions}</p>
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
											class="flex-1 sm:flex-none px-3 py-2 md:px-4 md:py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 text-xs md:text-sm font-medium transition touch-manipulation"
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
</div>
