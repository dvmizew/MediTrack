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

	// Admin-specific state
	let adminOverview = $state<any>(null);
	let adminLoading = $state(false);
	let adminError = $state<string | null>(null);
	let adherence7Canvas = $state<HTMLCanvasElement | null>(null);
	let adherence30Canvas = $state<HTMLCanvasElement | null>(null);
	let adherence7Chart: Chart | null = null;
	let adherence30Chart: Chart | null = null;

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

	const adminCards = $derived(adminOverview ? [
		{
			title: 'Utilizatori Total',
			value: adminOverview.users.active + adminOverview.users.inactive,
			sub: `Activi ${adminOverview.users.active} · Inactivi ${adminOverview.users.inactive}`,
			accent: 'text-blue-600 dark:text-blue-400'
		},
		{
			title: 'Colaborări',
			value: adminOverview.collaborations.reduce((a:any, c:any) => a + c.count, 0),
			sub: `Acceptate ${adminOverview.collaborations.find((c:any) => c.status === 'accepted')?.count || 0}`,
			accent: 'text-green-600 dark:text-green-400'
		},
		{
			title: 'Tratamente Active',
			value: adminOverview.treatments.active,
			sub: `Total ${adminOverview.treatments.total}`,
			accent: 'text-purple-600 dark:text-purple-400'
		},
		{
			title: 'Doze Total',
			value: adminOverview.doses.total,
			sub: `Ultim 7d: ${adminOverview.adherence.last7Days.confirmed}`,
			accent: 'text-orange-600 dark:text-orange-400'
		}
	] : []);
	
	// Chart references
	let adherenceChartCanvas = $state<HTMLCanvasElement | null>(null);
	let adherenceChart: Chart | null = null;
	let weeklyChartCanvas = $state<HTMLCanvasElement | null>(null);
	let weeklyChart: Chart | null = null;
	let medicationsChartCanvas = $state<HTMLCanvasElement | null>(null);
	let medicationsChart: Chart | null = null;
	const chartTheme = $derived({
		text: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches 
			|| document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#1f2937',
		grid: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches 
			|| document.documentElement.classList.contains('dark') ? '#4b5563' : '#d1d5db'
	});

	const isAdmin = $derived($authStore.user?.role === 'admin');

	function renderAdminCharts() {
		if (!adminOverview || !adherence7Canvas || !adherence30Canvas) return;
		const seven = adminOverview.adherence.last7Days;
		const thirty = adminOverview.adherence.last30Days;
		
		// Detect dark mode more reliably
		const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches 
			|| document.documentElement.classList.contains('dark');
		const textColor = isDark ? '#e5e7eb' : '#1f2937';
		const gridColor = isDark ? '#4b5563' : '#d1d5db';
		const tooltipBg = isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)';
		const tooltipText = isDark ? '#e5e7eb' : '#1f2937';

		// Destroy existing charts if any
		if (adherence7Chart) adherence7Chart.destroy();
		if (adherence30Chart) adherence30Chart.destroy();

		adherence7Chart = new Chart(adherence7Canvas, {
			type: 'doughnut',
			data: {
				labels: ['Confirmate', 'Rămase'],
				datasets: [{
					data: [seven.confirmed, Math.max(seven.scheduled - seven.confirmed, 0)],
					backgroundColor: ['#22c55e', '#f87171'],
					borderWidth: 0
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				plugins: {
					legend: {
						position: 'bottom',
						labels: { 
							boxWidth: 12, 
							padding: 8, 
							font: { size: 10, weight: '500' }, 
							color: textColor 
						}
					},
					tooltip: {
						backgroundColor: tooltipBg,
						titleColor: tooltipText,
						bodyColor: tooltipText,
						borderColor: isDark ? '#4b5563' : '#e5e7eb',
						borderWidth: 1,
						padding: 10,
						displayColors: true,
						titleFont: { size: 12, weight: 'bold' },
						bodyFont: { size: 11 }
					}
				},
				cutout: '70%'
			}
		});

		adherence30Chart = new Chart(adherence30Canvas, {
			type: 'bar',
			data: {
				labels: ['Programate', 'Confirmate'],
				datasets: [{
					data: [thirty.scheduled, thirty.confirmed],
					backgroundColor: ['#60a5fa', '#34d399'],
					borderRadius: 4,
					borderSkipped: false
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				plugins: { 
					legend: { display: false },
					tooltip: {
						backgroundColor: tooltipBg,
						titleColor: tooltipText,
						bodyColor: tooltipText,
						borderColor: isDark ? '#4b5563' : '#e5e7eb',
						borderWidth: 1,
						padding: 10,
						titleFont: { size: 12, weight: 'bold' },
						bodyFont: { size: 11 }
					}
				},
				scales: {
					y: { 
						beginAtZero: true, 
						ticks: { 
							font: { size: 11, weight: '500' }, 
							color: textColor,
							stepSize: Math.ceil(Math.max(thirty.scheduled, thirty.confirmed) / 5)
						}, 
						grid: { 
							color: gridColor,
							drawTicks: true
						} 
					},
					x: { 
						ticks: { 
							font: { size: 11, weight: '500' }, 
							color: textColor 
						}, 
						grid: { display: false } 
					}
				}
			}
		});
	}

	async function loadAdminOverview() {
		try {
			adminLoading = true;
			adminError = null;
			const token = $authStore.token;
			const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/admin/reports/overview`, {
				headers: { 'Authorization': `Bearer ${token}` }
			});
			if (!res.ok) throw new Error('Failed to load admin overview');
			adminOverview = await res.json();
			setTimeout(renderAdminCharts, 0);
		} catch (e: any) {
			adminError = e.message || 'Failed to load admin overview';
		} finally {
			adminLoading = false;
		}
	}

	onMount(async () => {
		if (isAdmin) {
			await loadAdminOverview();
			
			// Listen for theme changes - update admin charts
			themeUnsubscribe = themeStore.subscribe(() => {
				// Recreate admin charts with new theme colors (with delay to ensure DOM is updated)
				setTimeout(() => {
					if (adherence7Chart) adherence7Chart.destroy();
					if (adherence30Chart) adherence30Chart.destroy();
					renderAdminCharts();
				}, 50);
			});
		} else if ($isMedic) {
			await loadDashboardData();
		} else {
			await refreshUserStats();
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
				refreshUserStats();
				updateCharts();
				// also advance countdown
				tick();
			}, 60000);

			// separate second-based countdown interval
			countdownInterval = setInterval(tick, 1000);
			
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
		// Destroy all charts
		if (adherence7Chart) adherence7Chart.destroy();
		if (adherence30Chart) adherence30Chart.destroy();
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
			// normalize id for authStore consumers
			authStore.updateUser({ ...user, id: (user as any).id ?? (user as any).userId });
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
		
		// Overdue excludes snoozed items; uses effective scheduled time
		const overdue = todayMedications.filter((m) => {
			if (isMedicationTaken(m)) return false;
			if (isMedicationSnoozed(m, now)) return false;
			const scheduledTime = getMedicationScheduledTime(m, now);
			if (!scheduledTime) return false;
			return scheduledTime < now;
		}).length;
		
		const snoozed = todayMedications.filter((m) => isMedicationSnoozed(m, now)).length;

		// Find next upcoming medication considering snoozedUntil; if none, fallback to most recent overdue
		const enriched = todayMedications
			.filter((m) => !isMedicationTaken(m))
			.map((m) => ({ med: m, when: getMedicationScheduledTime(m, now) }))
			.filter((x) => x.when instanceof Date) as Array<{ med: any; when: Date }>;

		enriched.sort((a, b) => a.when.getTime() - b.when.getTime());

		const upcomingEntry = enriched.find((x) => x.when.getTime() >= now.getTime()) || null;

		let latestOverdueEntry: { med: any; when: Date } | null = null;
		if (!upcomingEntry) {
			const past = enriched.filter((x) => x.when.getTime() < now.getTime());
			past.sort((a, b) => b.when.getTime() - a.when.getTime());
			latestOverdueEntry = past[0] || null;
		}

		// store next dose for countdown updates
		nextDose = (upcomingEntry?.med || latestOverdueEntry?.med) || null;
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
		if (!nextDose) {
			countdownLabel = 'Nicio doză programată';
			return;
		}
		const now = new Date();
		const scheduledTime = getMedicationScheduledTime(nextDose, now);
		if (!scheduledTime) {
			countdownLabel = 'Nicio doză programată';
			return;
		}
		const diffMs = scheduledTime.getTime() - now.getTime();
		if (diffMs <= 0) {
			const displayTime = nextDose.ora || scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
			countdownLabel = `${displayTime} - ${nextDose.medicationName || 'Doză următoare'}`;
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
		const displayTime = nextDose.ora || scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		countdownLabel = `${label} până la ${nextDose.medicationName || 'doza următoare'} (${displayTime})`;
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
		return med.rezultat === 'pozitiv';
	}

	function isMedicationSnoozed(med: any, now = new Date()) {
		return !isMedicationTaken(med) && med.snoozedUntil && new Date(med.snoozedUntil) > now;
	}

	// Determine the effective scheduled Date for a medication today
	function getMedicationScheduledTime(med: any, now = new Date()): Date | null {
		if (isMedicationTaken(med)) return null;
		if (isMedicationSnoozed(med, now)) {
			return new Date(med.snoozedUntil);
		}
		if (!med.ora) return null;
		const [hours, minutes] = String(med.ora).split(':').map(Number);
		const scheduled = new Date();
		scheduled.setHours(hours, minutes, 0, 0);
		return scheduled;
	}

	function buildTodayTimeline() {
		// Always use historical 7-day data for the timeline chart when available
		if (adherenceHistory.length > 0) {
			return {
				labels: adherenceHistory.map((d: any) => {
					const date = new Date(d.date);
					return date.toLocaleDateString('ro-RO', { month: 'short', day: 'numeric' });
				}),
				data: adherenceHistory.map((d: any) => d.adherenceRate || 0)
			};
		}

		// Fallback: if no history, show today's adherence as single point
		const todayRate = stats.total > 0 
			? Math.round((stats.taken / stats.total) * 100)
			: 0;
		
		return {
			labels: ['Astăzi'],
			data: [todayRate]
		};
	}

	function getMedicationDistribution() {
		// Count unique medications from today's schedule
		const dailyCounts = new Map<string, number>();
		
		// Count how many doses per medication today
		todayMedications.forEach((m) => {
			const name = m.medicationName || 'Fără nume';
			dailyCounts.set(name, (dailyCounts.get(name) || 0) + 1);
		});
		
		if (dailyCounts.size === 0) {
			return { 
				labels: ['Nicio medicație'], 
				data: [0] 
			};
		}

		// Convert to array, multiply by 7 for weekly estimate, sort by count
		const sortedMeds = Array.from(dailyCounts.entries())
			.map(([name, dailyCount]) => ({ name, weeklyCount: dailyCount * 7 }))
			.sort((a, b) => b.weeklyCount - a.weeklyCount)
			.slice(0, 6); // Top 6 medications

		return {
			labels: sortedMeds.map(m => m.name),
			data: sortedMeds.map(m => m.weeklyCount)
		};
	}

	function initializeCharts() {
		const { text: textColor, grid: gridColor } = chartTheme;
		const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches 
			|| document.documentElement.classList.contains('dark');
		const tooltipBg = isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)';

		// Weekly Adherence Rate Chart (Doughnut) — using 7-day average percentage
		if (adherenceChartCanvas) {
			const weeklyRate = stats.weeklyAdherence;
			// Show percentage directly: weeklyRate% completed, (100-weeklyRate)% remaining

			adherenceChart = new Chart(adherenceChartCanvas, {
				type: 'doughnut',
				data: {
					labels: ['Conformitate', 'Rămas'],
					datasets: [{
						data: [weeklyRate, 100 - weeklyRate],
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
							labels: { 
								color: textColor,
								font: { size: 11, weight: '500' }
							}
						},
						title: {
							display: true,
							text: `Conformitate săptămânală: ${weeklyRate}%`,
							color: textColor,
							font: { size: 16, weight: 'bold' }
						},
						tooltip: {
							backgroundColor: tooltipBg,
							titleColor: textColor,
							bodyColor: textColor,
							borderColor: isDark ? '#4b5563' : '#e5e7eb',
							borderWidth: 1,
							padding: 10,
							titleFont: { size: 12, weight: 'bold' },
							bodyFont: { size: 11 }
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
							labels: { 
								color: textColor,
								font: { size: 11, weight: '500' }
							}
						},
						tooltip: {
							backgroundColor: tooltipBg,
							titleColor: textColor,
							bodyColor: textColor,
							borderColor: isDark ? '#4b5563' : '#e5e7eb',
							borderWidth: 1,
							padding: 10,
							titleFont: { size: 12, weight: 'bold' },
							bodyFont: { size: 11 }
						}
					},
					scales: {
						y: {
							beginAtZero: true,
							max: 100,
							ticks: { 
								color: textColor,
								font: { size: 11, weight: '500' }
							},
							grid: { color: gridColor }
						},
						x: {
							ticks: { 
								color: textColor,
								font: { size: 11, weight: '500' }
							},
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
						},
						tooltip: {
							backgroundColor: tooltipBg,
							titleColor: textColor,
							bodyColor: textColor,
							borderColor: isDark ? '#4b5563' : '#e5e7eb',
							borderWidth: 1,
							padding: 10,
							titleFont: { size: 12, weight: 'bold' },
							bodyFont: { size: 11 }
						}
					},
					scales: {
						y: {
							beginAtZero: true,
							ticks: { 
								stepSize: 1,
								color: textColor,
								font: { size: 11, weight: '500' }
							},
							grid: { color: gridColor }
						},
						x: {
							ticks: { 
								color: textColor,
								font: { size: 11, weight: '500' }
							},
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
			// Update with correct percentage data
			adherenceChart.data.datasets[0].data = [weeklyRate, 100 - weeklyRate];
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
{:else if isAdmin}
	<!-- Admin Dashboard -->
	<div class="space-y-4 md:space-y-6">
		<!-- Header -->
		<div class="space-y-1">
			<h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
			<p class="text-sm text-gray-600 dark:text-gray-300">Prezentare generală a sistemului, activitate și conformitate</p>
		</div>

		{#if adminLoading}
			<div class="p-6 text-gray-900 dark:text-gray-100">Se încarcă rapoarte…</div>
		{:else if adminError}
			<div class="p-6 text-red-600 dark:text-red-400">{adminError}</div>
		{:else if adminOverview}
			<div class="space-y-4 md:space-y-6">
				<!-- KPI Cards + Action Button Row -->
				<div class="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5">
					<!-- Cards Section (4 columns) -->
					<div class="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
						{#each adminCards as card}
							<Card title={card.title} value={card.value} sub={card.sub} accent={card.accent} />
						{/each}
					</div>
					
					<!-- Action Button (1 column, taller) -->
					<div class="lg:col-span-1 flex">
						<ActionButton 
							label="Gestionează Utilizatori"
							description="Vizualizează, editează și monitorizează"
							href="/admin/users"
							bg="border-blue-400 dark:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10"
							iconBg="bg-blue-100 dark:bg-blue-900/30"
							iconColor="text-blue-600 dark:text-blue-400"
							iconPath="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
						/>
					</div>
				</div>

				<!-- 2-Column Layout for Content Sections -->
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<!-- Left Column -->
					<div class="space-y-6">
						<!-- Users by Role -->
						<section class="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
							<div class="p-6 border-b border-gray-200 dark:border-gray-700">
								<h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">👤 Utilizatori după Rol</h2>
							</div>
							<div class="p-6 grid gap-3">
								{#if adminOverview.users.byRole && adminOverview.users.byRole.length > 0}
									{#each adminOverview.users.byRole as r}
										<div class="rounded-lg bg-gray-50 dark:bg-gray-900 p-3 flex items-center justify-between hover:shadow-md transition-all">
											<div class="font-medium capitalize text-gray-900 dark:text-gray-100">
												{#if r.role === 'admin'}
													👑 Administrator
												{:else if r.role === 'medic'}
													👨‍⚕️ Medic
												{:else}
													🧑 Pacient
												{/if}
											</div>
											<div class="text-xl font-semibold text-gray-900 dark:text-gray-100">{r.count}</div>
										</div>
									{/each}
								{:else}
									<div class="py-8 text-center text-gray-500 dark:text-gray-400">
										<div class="text-3xl mb-2">👥</div>
										<p class="text-sm">Nu sunt utilizatori în sistem</p>
									</div>
								{/if}
							</div>
						</section>

						<!-- Collaborations -->
						<div class="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
							<div class="p-6 border-b border-gray-200 dark:border-gray-700">
								<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">🤝 Status Colaborări</h2>
							</div>
							<div class="p-4 space-y-2">
								{#if adminOverview.collaborations && adminOverview.collaborations.length > 0}
									{#each adminOverview.collaborations as c}
										<div class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
											<span class="capitalize text-gray-600 dark:text-gray-300 text-sm">
												{#if c.status === 'pending'}
													⏳ În așteptare
												{:else if c.status === 'accepted'}
													✅ Acceptate
												{:else if c.status === 'rejected'}
													❌ Respinse
												{:else}
													{c.status}
												{/if}
											</span>
											<span class="font-semibold text-gray-900 dark:text-gray-100">{c.count}</span>
										</div>
									{/each}
								{:else}
									<div class="py-6 text-center text-gray-500 dark:text-gray-400">
										<div class="text-3xl mb-2">🤷</div>
										<p class="text-sm">Nicio colaborare în sistem</p>
									</div>
								{/if}
							</div>
						</div>

						<!-- 7-Day Adherence Chart -->
						<div class="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
							<div class="p-6 border-b border-gray-200 dark:border-gray-700">
								<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">📅 Conformitate - 7 zile</h2>
							</div>
							<div class="p-6">
								{#if adminOverview.adherence.last7Days.scheduled > 0}
									<div class="mb-4 max-w-[200px] mx-auto">
										<canvas bind:this={adherence7Canvas}></canvas>
									</div>
									<div class="grid grid-cols-3 gap-2 text-xs text-center">
										<div><div class="text-gray-500">Programate</div><div class="font-semibold text-gray-900 dark:text-gray-100">{adminOverview.adherence.last7Days.scheduled}</div></div>
										<div><div class="text-gray-500">Confirmate</div><div class="font-semibold text-gray-900 dark:text-gray-100">{adminOverview.adherence.last7Days.confirmed}</div></div>
										<div><div class="text-gray-500">Rată</div><div class="font-semibold text-gray-900 dark:text-gray-100">{adminOverview.adherence.last7Days.rate}</div></div>
									</div>
								{:else}
									<div class="py-8 text-center text-gray-500 dark:text-gray-400">
										<div class="text-3xl mb-2">📊</div>
										<p class="text-sm">Nicio dată de conformitate în ultimele 7 zile</p>
									</div>
								{/if}
							</div>
						</div>
					</div>

					<!-- Right Column -->
					<div class="space-y-6">
						<!-- Treatments -->
						<div class="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
							<div class="p-6 border-b border-gray-200 dark:border-gray-700">
								<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">💊 Tratamente</h2>
								<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Status și numere</p>
							</div>
							<div class="p-4 space-y-2">
								{#if adminOverview.treatments.total > 0}
									<div class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
										<span class="text-gray-600 dark:text-gray-300 text-sm">Activ</span>
										<span class="font-semibold text-gray-900 dark:text-gray-100">{adminOverview.treatments.active}</span>
									</div>
									<div class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
										<span class="text-gray-600 dark:text-gray-300 text-sm">Inactiv</span>
										<span class="font-semibold text-gray-900 dark:text-gray-100">{adminOverview.treatments.inactive}</span>
									</div>
									<div class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
										<span class="text-gray-600 dark:text-gray-300 text-sm">Total</span>
										<span class="font-semibold text-gray-900 dark:text-gray-100">{adminOverview.treatments.total}</span>
									</div>
								{:else}
									<div class="py-6 text-center text-gray-500 dark:text-gray-400">
										<div class="text-3xl mb-2">💊</div>
										<p class="text-sm">Niciun tratament în sistem</p>
									</div>
								{/if}
							</div>
						</div>

						<!-- 30-Day Adherence Chart -->
						<div class="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
							<div class="p-6 border-b border-gray-200 dark:border-gray-700">
								<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">📈 Conformitate - 30 zile</h2>
							</div>
							<div class="p-6">
								{#if adminOverview.adherence.last30Days.scheduled > 0}
									<div class="mb-4 max-w-[200px] mx-auto">
										<canvas bind:this={adherence30Canvas}></canvas>
									</div>
									<div class="grid grid-cols-3 gap-2 text-xs text-center">
										<div><div class="text-gray-500">Programate</div><div class="font-semibold text-gray-900 dark:text-gray-100">{adminOverview.adherence.last30Days.scheduled}</div></div>
										<div><div class="text-gray-500">Confirmate</div><div class="font-semibold text-gray-900 dark:text-gray-100">{adminOverview.adherence.last30Days.confirmed}</div></div>
										<div><div class="text-gray-500">Rată</div><div class="font-semibold text-gray-900 dark:text-gray-100">{adminOverview.adherence.last30Days.rate}</div></div>
									</div>
								{:else}
									<div class="py-8 text-center text-gray-500 dark:text-gray-400">
										<div class="text-3xl mb-2">📊</div>
										<p class="text-sm">Nicio dată de conformitate în ultimele 30 zile</p>
									</div>
								{/if}
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
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
