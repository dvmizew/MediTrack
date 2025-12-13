<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Chart } from 'chart.js/auto';
	import { api } from '$lib/api/client';
	import { authStore, isPacient, isMedic } from '$lib/stores/auth';
	import { themeStore } from '$lib/stores/theme';
	import { goto } from '$app/navigation';
	import Card from '$lib/components/Card.svelte';
	import ActionButton from '$lib/components/ActionButton.svelte';
	import PatientsList from '$lib/components/PatientsList.svelte';
	import TreatmentsList from '$lib/components/TreatmentsList.svelte';
	import MedicationsList from '$lib/components/MedicationsList.svelte';
	import ChartsGroup from '$lib/components/ChartsGroup.svelte';
	import WelcomeCard from '$lib/components/WelcomeCard.svelte';

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
		weeklyAdherence: 0
	});

	// Medic-specific state
	let patients = $state<any[]>([]);
	let treatments = $state<any[]>([]);
	let messagesCount = $state(0);
	let medicStats = $state({
		totalPatients: 0,
		activeTreatments: 0,
		pendingInvites: 0
	});

	// Derived UI data to avoid duplication
	const patientCards = $derived([
		{
			title: 'Conformitate săptămânală',
			value: `${stats.weeklyAdherence}%`,
			sub: 'Media ultimelor 7 zile',
			accent: 'text-gray-900 dark:text-gray-100'
		},
		{
			title: 'Astăzi',
			value: `${stats.taken}/${stats.total}`,
			sub: `${stats.snoozed} amânate • ${stats.overdue} întârziate`,
			accent: 'text-gray-900 dark:text-gray-100'
		},
		{
			title: 'Următoarea doză',
			value: stats.upcomingLabel,
			sub: `Actualizat la ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
			accent: 'text-gray-900 dark:text-gray-100'
		},
		{
			title: 'Streak',
			value: $authStore.user.currentStreak || 0,
			sub: 'zile consecutive',
			accent: 'text-green-600 dark:text-green-400'
		}
	]);

	const medicCards = $derived([
		{
			title: 'Pacienți Activi',
			value: medicStats.totalPatients,
			iconColor: 'text-blue-600 dark:text-blue-400',
			iconBg: 'bg-blue-100 dark:bg-blue-900/30',
			iconPath: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
		},
		{
			title: 'Tratamente Active',
			value: medicStats.activeTreatments,
			iconColor: 'text-green-600 dark:text-green-400',
			iconBg: 'bg-green-100 dark:bg-green-900/30',
			iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'
		},
		{
			title: 'Invitații În Așteptare',
			value: medicStats.pendingInvites,
			iconColor: 'text-yellow-600 dark:text-yellow-400',
			iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
			iconPath: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
		},
		{
			title: 'Mesaje Noi',
			value: messagesCount,
			iconColor: 'text-purple-600 dark:text-purple-400',
			iconBg: 'bg-purple-100 dark:bg-purple-900/30',
			iconPath: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z'
		}
	]);

	const medicActions = $derived([
		{
			label: 'Tratament Nou',
			description: 'Crează un plan de tratament',
			href: '/treatments/new',
			bg: 'border-blue-400 dark:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10',
			iconBg: 'bg-blue-100 dark:bg-blue-900/30',
			iconColor: 'text-blue-600 dark:text-blue-400',
			iconPath: 'M12 4v16m8-8H4'
		},
		{
			label: 'Vezi Invitații',
			description: 'Gestionează colaborările',
			href: '/collaborations',
			bg: 'border-green-400 dark:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/10',
			iconBg: 'bg-green-100 dark:bg-green-900/30',
			iconColor: 'text-green-600 dark:text-green-400',
			iconPath: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
		},
		{
			label: 'Mesaje',
			description: 'Comunică cu pacienții',
			href: '/chat',
			bg: 'border-purple-400 dark:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/10',
			iconBg: 'bg-purple-100 dark:bg-purple-900/30',
			iconColor: 'text-purple-600 dark:text-purple-400',
			iconPath: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
		}
	]);
	
	// Chart references
	let adherenceChartCanvas = $state<HTMLCanvasElement | null>(null);
	let adherenceChart: Chart | null = null;
	let weeklyChartCanvas = $state<HTMLCanvasElement | null>(null);
	let weeklyChart: Chart | null = null;
	let medicationsChartCanvas = $state<HTMLCanvasElement | null>(null);
	let medicationsChart: Chart | null = null;
	const chartTheme = $derived({
		text: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
		grid: document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'
	});

	onMount(async () => {
		if ($isMedic) {
			await loadDashboardData();
		} else {
			await loadMedications();
			initializeCharts();

			// Live countdown timer for next dose
			const tick = () => {
				updateCountdown();
			};
			// start immediately and every second
			tick();
			refreshInterval = setInterval(() => {
				loadMedications();
				updateCharts();
				// also advance countdown
				tick();
			}, 60000);

			// separate second-based countdown interval
			countdownInterval = setInterval(tick, 1000);
			
			// Auto-refresh every 60 seconds
			// (moved above; includes tick)
			
			// Listen for theme changes
			themeUnsubscribe = themeStore.subscribe(() => {
				// Recreate charts with new theme colors
				if (adherenceChart) adherenceChart.destroy();
				if (weeklyChart) weeklyChart.destroy();
				if (medicationsChart) medicationsChart.destroy();
				initializeCharts();
			});
		}
		
		// Listen for real-time notifications
		window.addEventListener('notification', handleNotification as EventListener);
			window.addEventListener('new-message', handleNewMessage as EventListener);
	});

	onDestroy(() => {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
		if (countdownInterval) {
			clearInterval(countdownInterval);
		}
		if (themeUnsubscribe) {
			themeUnsubscribe();
		}
		if (adherenceChart) adherenceChart.destroy();
		if (weeklyChart) weeklyChart.destroy();
		if (medicationsChart) medicationsChart.destroy();
		window.removeEventListener('notification', handleNotification as EventListener);
		window.removeEventListener('new-message', handleNewMessage as EventListener);
	});

	function handleNotification(event: CustomEvent) {
		const detail = event.detail;
		if (detail?.type === 'reminder' || detail?.type === 'treatment_update' || detail?.type === 'alert') {
			if ($isMedic) {
				loadDashboardData();
			} else {
				loadMedications();
				refreshUserStats();
				updateCharts();
			}
		}
	}

	function handleNewMessage(event: CustomEvent) {
		messagesCount = messagesCount + 1;
		if ($isMedic) {
			// Optionally refresh patient/treatment lists if message impacts badges
			loadDashboardData();
		}
	}

	async function loadDashboardData() {
		try {
			loading = true;

			// Load patients (collaborations)
			const collabs = await api.getMyCollaborations();
			patients = collabs.slice(0, 5); // Show top 5 patients

			// Load treatments
			const treatmentData = await api.getTreatments();
			treatments = treatmentData.slice(0, 5); // Show recent 5

			// Load pending invites
			const invites = await api.getPendingInvites();

			// Update stats
			medicStats = {
				totalPatients: collabs.length,
				activeTreatments: treatmentData.length,
				pendingInvites: invites.length
			};
		} catch (error) {
			console.error('Failed to load dashboard data:', error);
		} finally {
			loading = false;
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
			
			// Load historical adherence data
			const history = await api.getMedicationHistoryAdherence(7);
			adherenceHistory = history.sort((a: any, b: any) => 
				new Date(a.date).getTime() - new Date(b.date).getTime()
			);
			
			// Now update stats after we have history data
			updateStats();
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
		const taken = todayMedications.filter(isMedicationTaken).length;
		
		// Parse time from "HH:mm" format and compare with current time
		const overdue = todayMedications.filter((m) => {
			if (isMedicationTaken(m)) return false;
			if (!m.ora) return false;
			
			const [hours, minutes] = m.ora.split(':').map(Number);
			const scheduledTime = new Date();
			scheduledTime.setHours(hours, minutes, 0, 0);
			
			return scheduledTime < now;
		}).length;
		
		const snoozed = todayMedications.filter((m) => isMedicationSnoozed(m, now)).length;

		// Find next upcoming medication
		const upcoming = todayMedications
			.filter((m) => {
				if (isMedicationTaken(m)) return false;
				if (!m.ora) return false;
				
				const [hours, minutes] = m.ora.split(':').map(Number);
				const scheduledTime = new Date();
				scheduledTime.setHours(hours, minutes, 0, 0);
				
				return scheduledTime >= now;
			})
			.sort((a, b) => {
				const [aH, aM] = a.ora.split(':').map(Number);
				const [bH, bM] = b.ora.split(':').map(Number);
				return (aH * 60 + aM) - (bH * 60 + bM);
			})[0];

		// store next dose for countdown updates
		nextDose = upcoming || null;
		updateCountdown();

		stats = {
			total,
			taken,
			overdue,
			snoozed,
			upcomingLabel: countdownLabel,
			weeklyAdherence: adherenceHistory.length > 0 ? Math.round(adherenceHistory.reduce((sum: number, d: any) => sum + (d.adherenceRate || 0), 0) / adherenceHistory.length) : (total ? Math.round((taken / total) * 100) : 0)
		};
	}

	// Countdown state and helpers
	let nextDose = $state<any | null>(null);
	let countdownLabel = $state('Nicio doză programată');
	let countdownInterval: ReturnType<typeof setInterval> | null = null;

	function updateCountdown() {
		if (!nextDose || !nextDose.ora) {
			countdownLabel = 'Nicio doză programată';
			// reflect in stats for live render
			stats = { ...stats, upcomingLabel: countdownLabel };
			return;
		}
		const now = new Date();
		const [hours, minutes] = String(nextDose.ora).split(':').map(Number);
		const scheduledTime = new Date();
		scheduledTime.setHours(hours, minutes, 0, 0);
		const diffMs = scheduledTime.getTime() - now.getTime();
		if (diffMs <= 0) {
			countdownLabel = `${nextDose.ora} - ${nextDose.medicationName || 'Doză următoare'}`;
			stats = { ...stats, upcomingLabel: countdownLabel };
			return;
		}
		const totalSeconds = Math.floor(diffMs / 1000);
		const h = Math.floor(totalSeconds / 3600);
		const m = Math.floor((totalSeconds % 3600) / 60);
		const s = totalSeconds % 60;
		const hh = h.toString().padStart(2, '0');
		const mm = m.toString().padStart(2, '0');
		const ss = s.toString().padStart(2, '0');
		const label = `${hh}:${mm}:${ss}`;
		countdownLabel = `${label} până la ${nextDose.medicationName || 'doza următoare'} (${nextDose.ora})`;
		stats = { ...stats, upcomingLabel: countdownLabel };
	}

	async function confirmMedication(medication: any) {
		try {
			await api.confirmMedication({
				doseId: medication.doseId,
				scheduledFor: new Date().toISOString()
			});
			await loadMedications();
			await refreshUserStats();
		} catch (error) {
			console.error('Failed to confirm medication:', error);
		}
	}

	async function snoozeMedication(medication: any) {
		try {
			await api.snoozeMedication({
				doseId: medication.doseId,
				scheduledFor: new Date().toISOString()
			});
			await loadMedications();
		} catch (error) {
			console.error('Failed to snooze medication:', error);
		}
	}

	function viewPatient(patientId: number) {
		goto(`/chat/${patientId}`);
	}

	function viewTreatment(planId: number) {
		goto(`/treatments/${planId}`);
	}

	function isMedicationTaken(med: any) {
		return med.rezultat === 'pozitiv' || Boolean(med.timestampConfirmare);
	}

	function isMedicationSnoozed(med: any, now = new Date()) {
		return !isMedicationTaken(med) && med.snoozedUntil && new Date(med.snoozedUntil) > now;
	}

	function buildTodayTimeline() {
		// Use historical 7-day data for the timeline chart
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
			.filter((m) => m.ora)
			.map((m) => {
				const [hours, minutes] = m.ora.split(':').map(Number);
				return {
					label: m.ora,
					when: hours * 60 + minutes,
					is_taken: m.rezultat === 'pozitiv' || m.timestampConfirmare
				};
			})
			.sort((a, b) => a.when - b.when);

		if (sorted.length === 0) {
			return {
				labels: ['—'],
				data: [stats.weeklyAdherence]
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
		// Count medications from the 7-day history
		const counts = new Map<string, number>();
		
		if (adherenceHistory.length > 0) {
			// Aggregate medication counts from history if available
			// For now, use todayMedications as fallback; ideally API would return historical meds
			adherenceHistory.forEach((day: any) => {
				// If history contains medication details, aggregate them
				// Otherwise, use today's distribution as proxy for weekly average
			});
		}
		
		// Use today's medications as the basis for weekly distribution
		// (assuming similar schedule daily)
		todayMedications.forEach((m) => {
			const name = m.medicationName || 'Fără nume';
			counts.set(name, (counts.get(name) || 0) * 7); // Multiply by 7 for weekly estimate
		});

		const labels = counts.size ? Array.from(counts.keys()).slice(0, 6) : ['Nicio medicație'];
		const data = labels.map((label) => counts.get(label) || 0);
		return { labels, data };
	}

	function initializeCharts() {
		const { text: textColor, grid: gridColor } = chartTheme;

		// Weekly Adherence Rate Chart (Doughnut) — using 7-day average
		if (adherenceChartCanvas) {
			const weeklyRate = stats.weeklyAdherence;
			// Estimate doses based on 7-day average
			const estimatedTaken = Math.round((weeklyRate / 100) * (stats.total || 10) * 7);
			const estimatedTotal = (stats.total || 10) * 7;

			adherenceChart = new Chart(adherenceChartCanvas, {
				type: 'doughnut',
				data: {
					labels: ['Luate', 'Rămase'],
					datasets: [{
						data: [estimatedTaken, estimatedTotal - estimatedTaken],
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
							text: `Conformitate săptămânală: ${weeklyRate}%`,
							color: textColor,
							font: { size: 16, weight: 'bold' }
						}
					}
				}
			});
		}

		// 7-day timeline (Line)
		if (weeklyChartCanvas) {
			const timeline = buildTodayTimeline();

			weeklyChart = new Chart(weeklyChartCanvas, {
				type: 'line',
				data: {
					labels: timeline.labels,
					datasets: [{
						label: 'Conformitate zilnică (%)',
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

		// 7-day Medications Distribution Chart (Bar)
		if (medicationsChartCanvas) {
			const distribution = getMedicationDistribution();

			medicationsChart = new Chart(medicationsChartCanvas, {
				type: 'bar',
				data: {
					labels: distribution.labels,
					datasets: [{
						label: 'Medicamente săptămânal',
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
		const { text: textColor, grid: gridColor } = chartTheme;
		
		if (adherenceChart) {
			const weeklyRate = stats.weeklyAdherence;
			const estimatedTaken = Math.round((weeklyRate / 100) * (stats.total || 10) * 7);
			const estimatedTotal = (stats.total || 10) * 7;
			
			adherenceChart.data.datasets[0].data = [estimatedTaken, estimatedTotal - estimatedTaken];
			if (adherenceChart.options.plugins?.title) {
				adherenceChart.options.plugins.title.text = `Conformitate săptămânală: ${weeklyRate}%`;
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

{#if $isMedic}
	<!-- Medic Dashboard -->
	<div class="space-y-4 md:space-y-6">
		<!-- Welcome Card -->
		<WelcomeCard name={$authStore.user.fullName} subtitle={`Ai grijă de ${medicStats.totalPatients} pacienți astăzi`} />

		<!-- Quick Stats -->
		<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
			{#each medicCards as card}
				<Card title={card.title} value={card.value} sub="" accent="text-gray-900 dark:text-gray-100" iconPath={card.iconPath} iconColor={card.iconColor} iconBg={card.iconBg} />
			{/each}
		</div>

		<!-- Quick Actions -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			{#each medicActions as action}
				<ActionButton href={action.href} label={action.label} description={action.description} iconPath={action.iconPath} iconBg={action.iconBg} iconColor={action.iconColor} borderHover={action.bg} />
			{/each}
		</div>

		<!-- Patients List -->
		<PatientsList {loading} {patients} onView={viewPatient}>
			<button slot="actions" onclick={() => goto('/collaborations')} class="text-sm text-blue-600 dark:text-blue-400 hover:underline">Vezi toți →</button>
		</PatientsList>

		<!-- Recent Treatments -->
		<TreatmentsList {loading} {treatments} onView={viewTreatment}>
			<button slot="actions" onclick={() => goto('/treatments')} class="text-sm text-blue-600 dark:text-blue-400 hover:underline">Vezi toate →</button>
		</TreatmentsList>
	</div>
{:else if $isPacient}
	<!-- Patient Dashboard -->
<div class="space-y-4 md:space-y-6">
	<!-- Welcome Card (patient, same design) -->
	<WelcomeCard name={$authStore.user.fullName} subtitle={`${$authStore.user.totalXp || 0} XP • Streak: ${$authStore.user.currentStreak || 0} zile`} />

	<!-- Quick Stats -->
	<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
		{#each patientCards as card}
			<Card title={card.title} value={card.value} sub={card.sub} accent={card.accent} />
		{/each}
	</div>

	<!-- Today's Medications -->
	<MedicationsList loading={loading} medications={todayMedications} isTakenFn={isMedicationTaken} isSnoozedFn={(m: any) => isMedicationSnoozed(m)} onConfirm={confirmMedication} onSnooze={snoozeMedication} />

	<!-- Charts Grid -->
	<ChartsGroup bind:adherenceCanvas={adherenceChartCanvas} bind:weeklyCanvas={weeklyChartCanvas} bind:medicationsCanvas={medicationsChartCanvas} />
	</div>
{/if}
