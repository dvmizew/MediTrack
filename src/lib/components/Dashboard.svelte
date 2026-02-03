<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Chart } from 'chart.js/auto';
	import { api, adminReportsApi } from '$lib/api/client';
	import { authStore, isPacient, isMedic } from '$lib/stores/auth';
	import { themeStore } from '$lib/stores/theme';
	import { goto } from '$app/navigation';
	import { isMedicationTaken, isMedicationSnoozed, getMedicationScheduledTime } from '$lib/utils/medications';
	import {
		Users,
		ClipboardList,
		Mail,
		MessageCircle,
		Plus,
		UserCheck,
		MessageSquare,
		BarChart3,
		User,
		CheckCircle2,
		Pill,
		Crown,
		Stethoscope,
		UserCircle,
		Clock,
		AlertCircle,
		AlertTriangle,
		HelpCircle,
		Calendar,
		TrendingUp,
		ChevronRight,
		ArrowRight,
		Star
	} from '@lucide/svelte';
	import {
		getChartTheme,
		createPercentageChart,
		createComparisonBarChart,
		createTimeSeriesChart,
		type ChartTheme
	} from '$lib/utils/charts';
	import Card from '$lib/components/Card.svelte';
	import ActionButton from '$lib/components/ActionButton.svelte';
	import PatientsList from '$lib/components/PatientsList.svelte';
	import TreatmentsList from '$lib/components/TreatmentsList.svelte';
	import MedicationsList from '$lib/components/MedicationsList.svelte';
	import ChartsGroup from '$lib/components/ChartsGroup.svelte';
	import WelcomeCard from '$lib/components/WelcomeCard.svelte';
	import type { Medication, Treatment, Collaboration, AdminOverview, Stats, MedicStats, User as ApiUser } from '$lib/types/api';

	type CollaborationStat = AdminOverview['collaborations'][number];
	type UserRoleCount = AdminOverview['users']['byRole'][number];
	type AdherenceRecord = {
		date: string;
		adherenceRate?: number;
		confirmed?: number;
		scheduled?: number;
	};
	type MedicationScheduleEntry = {
		med: Medication;
		when: Date;
	};

	let todayMedications = $state<Medication[]>([]);
	let adherenceHistory = $state<AdherenceRecord[]>([]);
	let loading = $state(true);
	let refreshInterval: ReturnType<typeof setInterval> | null = null;
	let themeUnsubscribe: (() => void) | null = null;
	let upcomingDoseShortLabel = $state('—');
	let stats = $state<Stats>({
		total: 0,
		taken: 0,
		overdue: 0,
		snoozed: 0,
		upcomingLabel: '—',
		weeklyAdherence: 0
	});

	// Medic-specific state
	let patients = $state<Collaboration[]>([]);
	let treatments = $state<Treatment[]>([]);
	let messagesCount = $state(0);
	let medicStats = $state<MedicStats>({
		totalPatients: 0,
		activeTreatments: 0,
		pendingInvites: 0
	});

	// Admin-specific state
	let adminOverview = $state<AdminOverview | null>(null);
	let adminLoading = $state(false);
	let adminError = $state<string | null>(null);
	let adherence7Canvas = $state<HTMLCanvasElement | null>(null);
	let adherence30Canvas = $state<HTMLCanvasElement | null>(null);
	let adherence7Chart: Chart | null = null;
	let adherence30Chart: Chart | null = null;

	const patientCards = $derived([
		{
			title: 'Conformitate săptămânală',
			value: `${stats?.weeklyAdherence ?? 0}%`,
			accent: 'text-gray-900 dark:text-slate-100',
			ariaLabel: `Conformitate săptămânală: ${stats?.weeklyAdherence ?? 0}%, media ultimelor 7 zile`
		},
		{
			title: 'Progres Astăzi',
			value: `${stats?.taken ?? 0}/${stats?.total ?? 0}`,
			sub: `${stats?.snoozed ?? 0} amânate • ${stats?.overdue ?? 0} întârziate`,
			nextDose: upcomingDoseShortLabel,
			accent: 'text-gray-900 dark:text-slate-100',
			ariaLabel: `Astăzi: ${stats?.taken ?? 0} din ${stats?.total ?? 0}, ${stats?.snoozed ?? 0} amânate, ${stats?.overdue ?? 0} întârziate. Următoarea doză: ${upcomingDoseShortLabel}`
		}
	]);

	const medicCards = $derived([
		{
			title: 'Pacienți Activi',
			value: medicStats.totalPatients,
			iconColor: 'text-blue-600 dark:text-blue-400',
			iconBg: 'bg-blue-100 dark:bg-blue-900/30',
			icon: Users,
			ariaLabel: `Pacienți activi: ${medicStats.totalPatients}`
		},
		{
			title: 'Tratamente Active',
			value: medicStats.activeTreatments,
			iconColor: 'text-green-600 dark:text-green-400',
			iconBg: 'bg-green-100 dark:bg-green-900/30',
			icon: ClipboardList,
			ariaLabel: `Tratamente active: ${medicStats.activeTreatments}`
		},
		{
			title: 'Invitații În Așteptare',
			value: medicStats.pendingInvites,
			iconColor: 'text-yellow-600 dark:text-yellow-400',
			iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
			icon: Mail,
			ariaLabel: `Invitații în așteptare: ${medicStats.pendingInvites}`
		},
		{
			title: 'Mesaje Noi',
			value: messagesCount,
			iconColor: 'text-purple-600 dark:text-purple-400',
			iconBg: 'bg-purple-100 dark:bg-purple-900/30',
			icon: MessageCircle,
			ariaLabel: `Mesaje noi: ${messagesCount}`
		}
	]);

	const medicActions = $derived([
		{
			label: 'Tratament Nou',
			description: 'Crează un plan de tratament',
			href: '/treatments?createNew=true',
			borderHover: 'border-blue-400 dark:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10',
			iconBg: 'bg-blue-100 dark:bg-blue-900/30',
			iconColor: 'text-blue-600 dark:text-blue-400',
			icon: Plus
		},
		{
			label: 'Vezi Invitații',
			description: 'Gestionează colaborările',
			href: '/collaborations',
			borderHover: 'border-green-400 dark:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/10',
			iconBg: 'bg-green-100 dark:bg-green-900/30',
			iconColor: 'text-green-600 dark:text-green-400',
			icon: UserCheck
		},
		{
			label: 'Mesaje',
			description: 'Comunică cu pacienții',
			href: '/chat',
			borderHover: 'border-purple-400 dark:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/10',
			iconBg: 'bg-purple-100 dark:bg-purple-900/30',
			iconColor: 'text-purple-600 dark:text-purple-400',
			icon: MessageSquare
		}
	]);

	const adminCards = $derived(adminOverview ? [
		{
			title: 'Utilizatori Total',
			value: (adminOverview.users.active ?? 0) + (adminOverview.users.inactive ?? 0),
			sub: `Activi ${adminOverview.users.active ?? 0} · Inactivi ${adminOverview.users.inactive ?? 0}`,
			accent: 'text-blue-600 dark:text-blue-400'
		},
		{
			title: 'Colaborări',
			value: adminOverview.collaborations.reduce((a, c) => a + c.count, 0),
			sub: `Acceptate ${adminOverview.collaborations.find((c) => c.status === 'accepted')?.count || 0}`,
			accent: 'text-green-600 dark:text-green-400'
		},
		{
			title: 'Tratamente Active',
			value: adminOverview.treatments.active ?? 0,
			sub: `Total ${adminOverview.treatments.total ?? 0}`,
			accent: 'text-purple-600 dark:text-purple-400'
		},
		{
			title: 'Doze Total',
			value: adminOverview.doses.total,
			sub: `Ultim 7d: ${adminOverview.adherence.last7Days.confirmed}`,
			accent: 'text-orange-600 dark:text-orange-400'
		}
	] : []);

	// Compute total users by role for progress bar calculations
	const totalUsersByRole = $derived.by(() => {
		if (!adminOverview?.users?.byRole) return 0;
		return adminOverview.users.byRole.reduce((sum: number, u: UserRoleCount) => sum + u.count, 0);
	});

	const totalCollaborations = $derived.by(() => {
		if (!adminOverview?.collaborations) return 0;
		return adminOverview.collaborations.reduce((sum: number, collab) => sum + collab.count, 0);
	});

	const acceptedCollaborations = $derived.by(() => {
		if (!adminOverview?.collaborations) return 0;
		return adminOverview.collaborations.find((c) => c.status === 'accepted')?.count ?? 0;
	});
	
	// Chart references
	let weeklyChartCanvas = $state<HTMLCanvasElement | null>(null);
	let weeklyChart: Chart | null = null;

	// Detect dark mode and get theme colors
	const isDarkMode = $derived.by(() => {
		if (typeof window !== 'undefined') {
			return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
				|| document.documentElement.classList.contains('dark');
		}
		return false;
	});

	const chartTheme: ChartTheme = $derived(getChartTheme(isDarkMode));

	const isAdmin = $derived($authStore.user?.role === 'admin');

	function renderAdminCharts() {
		if (!adminOverview || !adherence7Canvas || !adherence30Canvas) return;
		const seven = adminOverview.adherence.last7Days;
		const thirty = adminOverview.adherence.last30Days;

		// Destroy existing charts if any
		if (adherence7Chart) adherence7Chart.destroy();
		if (adherence30Chart) adherence30Chart.destroy();

		// 7-day adherence as percentage (doughnut)
		adherence7Chart = createPercentageChart(
			adherence7Canvas.getContext('2d')!,
			seven.confirmed,
			seven.scheduled,
			['Confirmate', 'Rămase'],
			chartTheme
		);

		// 30-day comparison bar chart
		adherence30Chart = createComparisonBarChart(
			adherence30Canvas.getContext('2d')!,
			['Programate', 'Confirmate'],
			[{ label: 'Programate', data: [thirty.scheduled] }, { label: 'Confirmate', data: [thirty.confirmed] }],
			chartTheme,
			Math.max(thirty.scheduled, thirty.confirmed)
		);
	}

	async function loadAdminOverview() {
		try {
			adminLoading = true;
			adminError = null;
			adminOverview = await adminReportsApi.getOverview();
			setTimeout(renderAdminCharts, 0);
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Failed to load admin overview';
			adminError = message;
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
				if (weeklyChart) weeklyChart.destroy();
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
		if (weeklyChart) weeklyChart.destroy();
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
			const msg = error instanceof Error ? error.message : String(error);
			console.error('Failed to load dashboard data:', msg);
		} finally {
			loading = false;
		}
	}

	async function refreshUserStats() {
		try {
			const user = await api.getProfile() as ApiUser & { id?: number };
			// normalize id for authStore consumers
			const normalizedId = user.id ?? user.userId;
			authStore.updateUser({
				id: normalizedId,
				email: user.email,
				fullName: user.fullName,
				role: user.role,
				avatarUrl: user.avatarUrl,
				totalXp: user.totalXp,
				currentStreak: user.currentStreak,
				longestStreak: user.longestStreak,
				currentBadge: user.currentBadge
			});
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			console.error('Failed to refresh user stats:', msg);
		}
	}

	async function loadMedications() {
		try {
			const today = new Date();
			let data = await api.getTodayMedications();
			
			// Fallback: if no meds returned, load from active treatment plans
			if (!data || data.length === 0) {
				const plans = await api.getTreatments() as Treatment[];
				const medsByPlan = await Promise.all(
					plans.map((plan) => api.getMedicationsForPlan(plan.planId))
				);
				data = medsByPlan
					.flat()
					.filter((m): m is Medication => Boolean(m) && m.isActive !== false)
					.filter((m) => {
						const start = m.startDate ? new Date(m.startDate) : null;
						const end = m.endDate ? new Date(m.endDate) : null;
						const afterStart = !start || start <= today;
						const beforeEnd = !end || end >= today;
						return afterStart && beforeEnd;
					});
			}

			todayMedications = data;
			
			// Load historical adherence data
			const history = await api.getMedicationHistoryAdherence(7) as AdherenceRecord[];
			adherenceHistory = history.sort((a, b) => 
				new Date(a.date).getTime() - new Date(b.date).getTime()
			);
			
			// Now update stats after we have history data
			updateStats();
			updateCharts();
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			console.error('Failed to load medications:', msg);
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
		streakBroken = overdue > 0;

		// Find next upcoming medication considering snoozedUntil; if none, fallback to most recent overdue
		const enriched = todayMedications
			.filter((m) => !isMedicationTaken(m))
			.map((m) => ({ med: m, when: getMedicationScheduledTime(m, now) }))
			.filter((x): x is MedicationScheduleEntry => x.when instanceof Date);

		enriched.sort((a, b) => a.when.getTime() - b.when.getTime());

		const upcomingEntry = enriched.find((x) => x.when.getTime() >= now.getTime()) || null;

		let latestOverdueEntry: MedicationScheduleEntry | null = null;
		if (!upcomingEntry) {
			const past = enriched.filter((x) => x.when.getTime() < now.getTime());
			past.sort((a, b) => b.when.getTime() - a.when.getTime());
			latestOverdueEntry = past[0] || null;
		}

		allDoneToday = total > 0 && taken === total;

		// store next dose for countdown updates
		nextDose = allDoneToday ? null : (upcomingEntry?.med || latestOverdueEntry?.med) || null;
		const scheduledTime = nextDose ? getMedicationScheduledTime(nextDose, now) : null;
		if (scheduledTime) {
			const targetMs = scheduledTime.getTime();
			if (countdownTargetMs !== targetMs) {
				countdownTargetMs = targetMs;
				countdownTotalSeconds = Math.max(1, Math.floor((targetMs - now.getTime()) / 1000));
			}
		} else {
			countdownTargetMs = null;
			countdownTotalSeconds = 0;
		}
		updateCountdown();

		stats = {
			total,
			taken,
			overdue,
			snoozed,
			upcomingLabel: countdownLabel,
			weeklyAdherence: adherenceHistory.length > 0 ? Math.round(adherenceHistory.reduce((sum: number, d) => sum + (d.adherenceRate ?? 0), 0) / adherenceHistory.length) : (total ? Math.round((taken / total) * 100) : 0)
		};
	}

	// Countdown state and helpers
	let nextDose = $state<Medication | null>(null);
	let countdownLabel = $state('Nicio doză programată');
	let countdownText = $state('--:--:--');
	let countdownTotalSeconds = $state(0);
	let countdownProgress = $state(0);
	let countdownTargetMs = $state<number | null>(null);
	let countdownStatus = $state<'none' | 'normal' | 'warning' | 'critical' | 'done'>('none');
	let allDoneToday = $state(false);
	let streakBroken = $state(false);
	const displayStreak = $derived(streakBroken ? 0 : ($authStore.user?.currentStreak || 0));
	let countdownInterval: ReturnType<typeof setInterval> | null = null;

	function updateCountdown() {
		if (!nextDose) {
			if (allDoneToday) {
				countdownLabel = 'Ai terminat pentru astăzi';
				upcomingDoseShortLabel = '—';
				countdownText = 'Bravo!';
				countdownProgress = 1;
				countdownStatus = 'done';
				return;
			}
			countdownLabel = 'Nicio doză programată';
			upcomingDoseShortLabel = '—';
			countdownText = '--:--:--';
			countdownProgress = 0;
			countdownStatus = 'none';
			return;
		}
		const now = new Date();
		const scheduledTime = getMedicationScheduledTime(nextDose, now);
		if (!scheduledTime) {
			countdownLabel = 'Nicio doză programată';
			upcomingDoseShortLabel = '—';
			countdownText = '--:--:--';
			countdownProgress = 0;
			countdownStatus = 'none';
			return;
		}
		const diffMs = scheduledTime.getTime() - now.getTime();
		if (diffMs <= 0) {
			const displayTime = nextDose.time || scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
			countdownLabel = `${displayTime} - ${nextDose.medicationName || 'Doză următoare'}`;
			upcomingDoseShortLabel = `${displayTime} - ${nextDose.medicationName || 'Doză următoare'}`;
			countdownText = '00:00:00';
			countdownProgress = 1;
			countdownStatus = 'critical';
			streakBroken = true;
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
		const displayTime = nextDose.time || scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		countdownLabel = `${label} până la ${nextDose.medicationName || 'doza următoare'} (${displayTime})`;
		upcomingDoseShortLabel = `${displayTime} - ${nextDose.medicationName || 'doza următoare'}`;
		countdownText = label;
		if (totalSeconds <= 10 * 60) {
			countdownStatus = 'critical';
		} else if (totalSeconds <= 30 * 60) {
			countdownStatus = 'warning';
		} else {
			countdownStatus = 'normal';
		}
		const maxWindowSeconds = 24 * 60 * 60;
		const warningWindowSeconds = 30 * 60;
		const clampedRemaining = Math.min(totalSeconds, maxWindowSeconds);
		if (clampedRemaining <= warningWindowSeconds) {
			const nearRatio = clampedRemaining / warningWindowSeconds;
			countdownProgress = Math.max(0, Math.min(1, 0.7 + (1 - nearRatio) * 0.3));
		} else {
			const farRemaining = clampedRemaining - warningWindowSeconds;
			const farWindow = maxWindowSeconds - warningWindowSeconds;
			const farRatio = farRemaining / farWindow;
			countdownProgress = Math.max(0, Math.min(1, 0.7 * (1 - farRatio)));
		}
	}

	async function confirmMedication(medication: Medication) {
		try {
			await api.confirmMedication({
				doseId: medication.doseId,
				scheduledFor: new Date().toISOString()
			});
			await loadMedications();
			await refreshUserStats();
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			console.error('Failed to confirm medication:', msg);
		}
	}

	async function snoozeMedication(medication: Medication) {
		try {
			await api.snoozeMedication({
				doseId: medication.doseId,
				scheduledFor: new Date().toISOString()
			});
			await loadMedications();
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			console.error('Failed to snooze medication:', msg);
		}
	}

	function viewPatient(patientId: number) {
		goto(`/chat/${patientId}`);
	}

	function viewTreatment(planId: number) {
		goto(`/treatments/${planId}`);
	}

	function buildTodayTimeline() {
		// Always use historical 7-day data for the timeline chart when available
		if (adherenceHistory.length > 0) {
			return {
				labels: adherenceHistory.map((d) => {
					const date = new Date(d.date);
					return date.toLocaleDateString('ro-RO', { month: 'short', day: 'numeric' });
				}),
				data: adherenceHistory.map((d) => d.adherenceRate ?? 0)
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
		// 7-day timeline (Line)
		if (weeklyChartCanvas) {
			const timeline = buildTodayTimeline();

			if (weeklyChart) weeklyChart.destroy();
			weeklyChart = createTimeSeriesChart(
				weeklyChartCanvas.getContext('2d')!,
				timeline.labels,
				timeline.data,
				'#3b82f6',
				'rgba(59, 130, 246, 0.1)',
				chartTheme,
				100
			);
		}
	}

	function updateCharts() {
		// On theme change, reinitialize all charts to apply new theme colors
		initializeCharts();
	}
</script>

{#if $isMedic}
	<!-- Medic Dashboard -->
	<div class="space-y-4 md:space-y-6">
		<!-- Welcome Card -->
		<WelcomeCard name={$authStore.user?.fullName || ''} subtitle={`Ai grijă de ${medicStats.totalPatients} pacienți astăzi`} />

		<!-- Quick Stats -->
		<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
			{#each medicCards as card}
				<Card title={card.title} value={card.value} sub="" accent="text-gray-900 dark:text-slate-100" icon={card.icon} iconColor={card.iconColor} iconBg={card.iconBg} ariaLabel={card.ariaLabel} />
			{/each}
		</div>

		<!-- Quick Actions -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			{#each medicActions as action}
				<ActionButton href={action.href} label={action.label} description={action.description} icon={action.icon} iconBg={action.iconBg} iconColor={action.iconColor} borderHover={action.borderHover} />
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
			<h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-slate-100">Admin Dashboard</h1>
			<p class="text-sm text-gray-700 dark:text-slate-300 font-medium">Prezentare generală a sistemului, activitate și conformitate</p>
		</div>

		{#if adminLoading}
			<div class="p-6 text-gray-900 dark:text-slate-100">Se încarcă rapoarte…</div>
		{:else if adminError}
			<div class="p-6 text-red-600 dark:text-red-400">{adminError}</div>
		{:else if adminOverview}
			<div class="space-y-4 md:space-y-6">
				<!-- KPI Cards Grid -->
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
					{#each adminCards as card}
						<article
							class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 border-l-4 {card.accent === 'text-blue-600 dark:text-blue-400' ? 'border-l-blue-500' : card.accent === 'text-green-600 dark:text-green-400' ? 'border-l-green-500' : card.accent === 'text-purple-600 dark:text-purple-400' ? 'border-l-purple-500' : 'border-l-orange-500'} rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 shadow-sm dark:shadow-lg hover:shadow-md dark:hover:shadow-xl transition-all"
							role="region"
							aria-label={`${card.title}: ${card.value}${card.sub ? `, ${card.sub}` : ''}`}
						>
							<div class="text-xs sm:text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2 truncate">{card.title}</div>
							<div class="text-xl sm:text-2xl md:text-3xl font-bold {card.accent} mb-1">{card.value}</div>
							<p class="text-xs text-gray-600 dark:text-slate-400 line-clamp-2">{card.sub}</p>
						</article>
					{/each}
				</div>

				<!-- Admin Modules Quick Links -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
					<!-- Users Management Card -->
					<a
						href="/admin/users"
						class="group bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-blue-500 rounded-xl p-4 sm:p-5 md:p-6 shadow-sm dark:shadow-lg hover:shadow-md dark:hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
						aria-label="Gestionează Utilizatori: Vizualizează, editează și monitorizează"
					>
						<div class="flex items-start justify-between gap-3 mb-3 sm:mb-4">
							<Users class="w-16 h-16 flex-shrink-0 text-blue-600 dark:text-blue-400" />
							<ArrowRight class="w-5 h-5 text-blue-400 dark:text-blue-300 group-hover:translate-x-1 transition-transform flex-shrink-0" />
						</div>
						<h3 class="text-base sm:text-lg font-bold text-blue-800 dark:text-blue-200 mb-1">Utilizatori</h3>
						<p class="text-xs sm:text-sm text-slate-700 dark:text-slate-300">Vizualizează, editează și monitorizează conturi</p>
					</a>

					<!-- Reports Card -->
					<a
						href="/admin/reports"
						class="group bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-emerald-500 rounded-xl p-4 sm:p-5 md:p-6 shadow-sm dark:shadow-lg hover:shadow-md dark:hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
						aria-label="Rapoarte: Overview și rapoarte detaliate"
					>
						<div class="flex items-start justify-between gap-3 mb-3 sm:mb-4">
							<BarChart3 class="w-16 h-16 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
							<ArrowRight class="w-5 h-5 text-emerald-400 dark:text-emerald-300 group-hover:translate-x-1 transition-transform flex-shrink-0" />
						</div>
						<h3 class="text-base sm:text-lg font-bold text-emerald-800 dark:text-emerald-200 mb-1">Rapoarte</h3>
						<p class="text-xs sm:text-sm text-slate-700 dark:text-slate-300">Overview și analize detaliate sistem</p>
					</a>
				</div>

				<!-- 2-Column Layout for Content Sections -->
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<!-- Left Column -->
					<div class="space-y-6">
						<!-- Users by Role -->
						<section class="rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-lg overflow-hidden">
							<div class="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
								<div>
									<h2 class="text-base sm:text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2"><User class="w-5 h-5" /> Utilizatori după Rol</h2>
									<p class="text-xs text-gray-600 dark:text-slate-400 mt-1">Distribuție pe roluri sistem</p>
								</div>
								<a href="/admin/users" class="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline w-fit">Gestionează →</a>
							</div>
							<div class="p-3 sm:p-4 md:p-6 space-y-3">
								{#if adminOverview.users.byRole && adminOverview.users.byRole.length > 0}
									{#each adminOverview.users.byRole as r}
										<div class="rounded-lg bg-white/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 p-3 sm:p-4 hover:shadow-md transition-all">
											<div class="flex items-center justify-between mb-2">
												<div class="flex items-center gap-2 font-medium text-gray-900 dark:text-slate-100">
													{#if r.role === 'admin'}
														<Crown class="w-6 h-6" />
														<span class="text-sm sm:text-base">Administrator</span>
													{:else if r.role === 'medic'}
														<Stethoscope class="w-6 h-6" />
														<span class="text-sm sm:text-base">Medic</span>
													{:else}
														<UserCircle class="w-6 h-6" />
														<span class="text-sm sm:text-base">Pacient</span>
													{/if}
												</div>
												<div class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100">{r.count}</div>
											</div>
											<!-- Progress bar -->
											<div class="w-full bg-slate-200/70 dark:bg-slate-700 rounded-full h-2 sm:h-2.5 overflow-hidden">
												<div 
													class="{r.role === 'admin' ? 'bg-gradient-to-r from-purple-500 to-purple-600' : r.role === 'medic' ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gradient-to-r from-green-500 to-green-600'} h-full transition-all duration-500 rounded-full"
													style="width: {totalUsersByRole > 0 ? (r.count / totalUsersByRole) * 100 : 0}%"
												></div>
											</div>
											<div class="text-xs text-gray-600 dark:text-slate-300 mt-1.5">
												{Math.round((r.count / totalUsersByRole) * 100)}% din total
											</div>
										</div>
									{/each}

									<!-- Summary -->
									<div class="mt-4 pt-3 border-t border-slate-200/70 dark:border-slate-800/70">
										<div class="flex items-center justify-between text-sm">
											<span class="text-gray-700 dark:text-slate-100">Total utilizatori:</span>
											<span class="font-bold text-gray-900 dark:text-slate-100">{totalUsersByRole}</span>
										</div>
									</div>
								{:else}
									<div class="py-8 text-center text-gray-500 dark:text-slate-400">
										<Users class="w-12 h-12 mx-auto mb-2" />
										<p class="text-sm">Nu sunt utilizatori în sistem</p>
									</div>
								{/if}
							</div>
						</section>

						<!-- Collaborations -->
						<div class="rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-lg overflow-hidden">
							<div class="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
								<div>
									<h2 class="text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2"><Users class="w-5 h-5" /> Status Colaborări</h2>
									<p class="text-xs text-gray-600 dark:text-slate-400 mt-1">Relații medic-pacient și acceptare</p>
								</div>
								<a href="/collaborations" class="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">Vezi toți →</a>
							</div>
							<div class="p-4 space-y-3">
								{#if adminOverview.collaborations && adminOverview.collaborations.length > 0}
									{#each adminOverview.collaborations as c}
										<div class="space-y-1.5">
											<div class="flex items-center justify-between">
												<div class="flex items-center gap-2">
													{#if c.status === 'pending'}
														<Clock class="w-5 h-5" />
														<span class="font-medium text-gray-900 dark:text-slate-100">În așteptare</span>
													{:else if c.status === 'accepted'}
														<CheckCircle2 class="w-5 h-5" />
														<span class="font-medium text-green-900 dark:text-green-100">Acceptate</span>
													{:else if c.status === 'rejected'}
														<AlertCircle class="w-5 h-5" />
														<span class="font-medium text-red-900 dark:text-red-100">Respinse</span>
													{:else}
														<span class="font-medium text-gray-900 dark:text-slate-100">{c.status}</span>
													{/if}
												</div>
												<span class="text-lg font-bold text-gray-900 dark:text-slate-100">{c.count}</span>
											</div>
											<!-- Progress bar with percentage -->
											<div class="w-full bg-slate-200/70 dark:bg-slate-800 rounded-full h-2 sm:h-2.5 overflow-hidden">
												<div 
													class="{c.status === 'accepted' ? 'bg-gradient-to-r from-green-500 to-green-600' : c.status === 'pending' ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' : 'bg-gradient-to-r from-red-500 to-red-600'} h-full transition-all duration-500 rounded-full"
													style="width: {totalCollaborations > 0 ? (c.count / totalCollaborations) * 100 : 0}%"
												></div>
											</div>
											<div class="text-xs text-gray-700 dark:text-slate-200">
												{#if c.status === 'accepted'}
													{Math.round((c.count / totalCollaborations) * 100)}% dintre relații
												{:else if c.status === 'pending'}
													În curs de procesare
												{:else}
													Nefinalizate
												{/if}
											</div>
										</div>
									{/each}
								{:else}
									<div class="py-6 text-center text-gray-500 dark:text-slate-400">
										<HelpCircle class="w-12 h-12 mx-auto mb-2" />
										<p class="text-sm">Nicio colaborare în sistem</p>
									</div>
								{/if}

								{#if adminOverview.collaborations && adminOverview.collaborations.length > 0}
									<div class="mt-4 pt-4 border-t border-slate-200/70 dark:border-slate-800/70 space-y-2 text-xs">
										<div class="flex justify-between">
											<span class="text-gray-700 dark:text-slate-300">Total colaborări:</span>
											<span class="font-semibold text-gray-900 dark:text-slate-100">{totalCollaborations}</span>
										</div>
										<div class="flex justify-between">
											<span class="text-gray-700 dark:text-slate-300">Rata acceptare:</span>
											<span class="font-semibold {totalCollaborations > 0 && (acceptedCollaborations / totalCollaborations) > 0.8 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}">{Math.round((acceptedCollaborations / (totalCollaborations || 1)) * 100)}%</span>
										</div>
									</div>
								{/if}
							</div>
						</div>
						<!-- 7-Day Adherence Chart -->
						<div class="rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-lg overflow-hidden">
							<div class="p-6 border-b border-slate-200 dark:border-slate-700">
								<h2 class="text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2"><Calendar class="w-5 h-5" /> Conformitate - 7 zile</h2>
							</div>
							<div class="p-6">
								{#if adminOverview.adherence.last7Days.scheduled > 0}
									<div class="mb-4 max-w-[200px] mx-auto" role="img" aria-label="Conformitate 7 zile - diagramă">
										<canvas bind:this={adherence7Canvas} aria-hidden="true"></canvas>
									</div>
									<div class="grid grid-cols-3 gap-2 text-xs text-center">
										<div><div class="text-gray-700 dark:text-slate-300">Programate</div><div class="font-semibold text-gray-900 dark:text-slate-100">{adminOverview.adherence.last7Days.scheduled}</div></div>
										<div><div class="text-gray-700 dark:text-slate-300">Confirmate</div><div class="font-semibold text-gray-900 dark:text-slate-100">{adminOverview.adherence.last7Days.confirmed}</div></div>
										<div><div class="text-gray-700 dark:text-slate-300">Rată</div><div class="font-semibold text-gray-900 dark:text-slate-100">{adminOverview.adherence.last7Days.rate}</div></div>
									</div>
								{:else}
									<div class="py-8 text-center text-gray-500 dark:text-slate-400">
										<BarChart3 class="w-12 h-12 mx-auto mb-2" />
										<p class="text-sm">Nicio dată de conformitate în ultimele 7 zile</p>
									</div>
								{/if}
							</div>
						</div>
					</div>

					<!-- Right Column -->
					<div class="space-y-6">
						<!-- Treatments -->
						<div class="rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-lg overflow-hidden">
							<div class="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
								<div>
									<h2 class="text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2"><Pill class="w-5 h-5" /> Tratamente</h2>
									<p class="text-sm text-gray-600 dark:text-slate-400 mt-1">Status și numere</p>
								</div>
								<a href="/treatments" class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium hover:underline transition-colors flex items-center gap-1">
									Vezi toți
									<ChevronRight class="w-4 h-4" />
								</a>
							</div>
							<div class="p-4 space-y-2">
								{#if adminOverview.treatments.total > 0}
									<div class="flex items-center justify-between p-3 rounded-lg bg-white/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
										<span class="text-gray-700 dark:text-slate-300 text-sm">Activ</span>
										<span class="font-semibold text-gray-900 dark:text-slate-100">{adminOverview.treatments.active ?? 0}</span>
									</div>
									<div class="flex items-center justify-between p-3 rounded-lg bg-white/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
										<span class="text-gray-700 dark:text-slate-300 text-sm">Inactiv</span>
										<span class="font-semibold text-gray-900 dark:text-slate-100">{adminOverview.treatments.inactive ?? 0}</span>
									</div>
									<div class="flex items-center justify-between p-3 rounded-lg bg-white/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
										<span class="text-gray-700 dark:text-slate-300 text-sm">Total</span>
										<span class="font-semibold text-gray-900 dark:text-slate-100">{adminOverview.treatments.total ?? 0}</span>
									</div>
								{:else}
									<div class="py-6 text-center text-gray-500 dark:text-slate-400">
										<Pill class="w-12 h-12 mx-auto mb-2" />
										<p class="text-sm">Niciun tratament în sistem</p>
									</div>
								{/if}
							</div>
						</div>

						<!-- 30-Day Adherence Chart -->
						<div class="rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-lg overflow-hidden">
							<div class="p-6 border-b border-slate-200 dark:border-slate-700">
								<h2 class="text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2"><TrendingUp class="w-5 h-5" /> Conformitate - 30 zile</h2>
							</div>
							<div class="p-6">
								{#if adminOverview.adherence.last30Days.scheduled > 0}
									<div class="mb-4 max-w-[200px] mx-auto" role="img" aria-label="Conformitate 30 zile - diagramă">
										<canvas bind:this={adherence30Canvas} aria-hidden="true"></canvas>
									</div>
									<div class="grid grid-cols-3 gap-2 text-xs text-center">
										<div><div class="text-gray-700 dark:text-slate-300">Programate</div><div class="font-semibold text-gray-900 dark:text-slate-100">{adminOverview.adherence.last30Days.scheduled}</div></div>
										<div><div class="text-gray-700 dark:text-slate-300">Confirmate</div><div class="font-semibold text-gray-900 dark:text-slate-100">{adminOverview.adherence.last30Days.confirmed}</div></div>
										<div><div class="text-gray-700 dark:text-slate-300">Rată</div><div class="font-semibold text-gray-900 dark:text-slate-100">{adminOverview.adherence.last30Days.rate}</div></div>
									</div>
								{:else}
									<div class="py-8 text-center text-gray-500 dark:text-slate-400">
										<BarChart3 class="w-12 h-12 mx-auto mb-2" />
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
<div
	class={`space-y-4 md:space-y-6 ${
		streakBroken ? 'rounded-3xl bg-slate-100/70 dark:bg-slate-900/60 p-4 md:p-6' : ''
	}`}
>
	<!-- Welcome Card (patient, same design) -->
	<WelcomeCard
		name={$authStore.user?.fullName || ''}
		title={
			allDoneToday
				? `Bun venit, ${$authStore.user?.fullName || ''}!`
				: streakBroken
					? `${$authStore.user?.fullName || ''}, streak pierdut`
					: countdownStatus === 'critical'
					? `${$authStore.user?.fullName || ''}, Streak în pericol!`
					: countdownStatus === 'warning'
						? `Bun venit, ${$authStore.user?.fullName || ''}!`
						: null
		}
		subtitle={
			allDoneToday
				? 'Ai îndeplinit toate misiunile!'
				: streakBroken
					? 'Timpul a trecut. Streak resetat la 0. Nu lăsa asta să devină un obicei...'
					: countdownStatus === 'critical'
						? `Nu strica progresul de ${displayStreak} zile!`
						: countdownStatus === 'warning'
							? 'Se apropie următoarea doză! Nu rata streakul!'
							: `${$authStore.user?.totalXp || 0} XP • Streak: ${displayStreak} zile`
		}
		tone={
			allDoneToday
				? 'celebrate'
				: streakBroken
					? 'sad'
					: countdownStatus === 'critical'
						? 'critical'
						: countdownStatus === 'warning'
							? 'warning'
							: 'default'
		}
	/>

	<!-- Daily XP Earned Showcase -->
	{#if allDoneToday}
		<div class="relative overflow-hidden bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 rounded-2xl shadow-lg p-8 border-2 border-yellow-200 dark:border-yellow-800">
			<!-- Animated background -->
			<div class="absolute inset-0 opacity-20">
				<div class="absolute top-0 left-0 w-40 h-40 bg-yellow-400 rounded-full blur-3xl animate-pulse"></div>
				<div class="absolute bottom-0 right-0 w-40 h-40 bg-amber-400 rounded-full blur-3xl animate-pulse"></div>
			</div>
			
			<div class="relative flex items-center justify-between">
				<div>
					<p class="text-sm font-semibold text-gray-800 dark:text-yellow-300 mb-1 inline-flex items-center gap-2">
						<Star class="w-5 h-5 animate-bounce" />
						Recompensă de astazi
					</p>
					<p class="text-4xl font-black text-gray-900 dark:text-yellow-100">+50 XP</p>
					<p class="text-sm text-gray-700 dark:text-yellow-300 mt-2">Felicitări! Ai îndeplinit toate misiunile!</p>
				</div>
				<div class="text-6xl drop-shadow-lg animate-bounce">🎉</div>
			</div>
		</div>
	{/if}

	<!-- Streak Loss Penalty Alert -->
	{#if streakBroken}
		<div class="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-l-4 border-l-red-600 dark:border-l-red-400 border border-red-200 dark:border-red-800 rounded-lg p-4 md:p-5 animate-pulse-alert">
			<div class="flex items-start gap-4">
				<div class="flex-shrink-0 mt-0.5">
					<div class="w-8 h-8 rounded-full bg-red-600 dark:bg-red-500 flex items-center justify-center text-white font-bold text-sm">−</div>
				</div>
				<div class="flex-1">
					<h3 class="font-bold text-red-900 dark:text-red-200 mb-1">Streak pierdut!</h3>
					<p class="text-sm text-red-800 dark:text-red-300 mb-2">
						Ai pierdut streakul tău. Ca penalitate, o parte din XP-ul zilei a fost retras.
					</p>
					<div class="text-xs text-red-700 dark:text-red-400 bg-white/40 dark:bg-black/20 rounded px-2 py-1 inline-block">
						−10% XP din doze completate astazi
					</div>
				</div>
			</div>
		</div>
	{:else if countdownStatus === 'critical'}
		<!-- Critical Warning -->
		<div class="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-l-4 border-l-orange-600 dark:border-l-orange-400 border border-orange-200 dark:border-orange-800 rounded-lg p-4 md:p-5 animate-pulse">
			<div class="flex items-start gap-3">
				<div class="flex-shrink-0">
					<AlertTriangle class="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
				</div>
				<div class="flex-1">
					<h3 class="font-semibold text-orange-900 dark:text-orange-200 mb-1">Streakul tău este în pericol!</h3>
					<p class="text-sm text-orange-800 dark:text-orange-300">
						Ai puțin timp pentru a confirma doza programată înainte să-ți pierzi streakul.
					</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Medications List -->
	<MedicationsList
		loading={loading}
		medications={todayMedications}
		isTakenFn={isMedicationTaken}
		isSnoozedFn={(m: Medication) => isMedicationSnoozed(m)}
		onConfirm={confirmMedication}
		onSnooze={snoozeMedication}
		celebrate={allDoneToday}
		streak={displayStreak}
		maxStreak={$authStore.user?.longestStreak || 0}
		countdownText={countdownText}
		countdownProgress={countdownProgress}
		countdownStatus={countdownStatus}
		nextDoseId={nextDose?.doseId ?? null}
		muted={streakBroken}
	/>

	<!-- Quick Stats -->
	<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
		{#each patientCards as card, idx}
			{#if idx === 0}
				<!-- Conformitate card -->
				<div class="sm:col-span-2 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-lg p-6 flex flex-col h-full">
					<div class="flex items-center justify-between mb-3">
						<h3 class="font-semibold text-gray-700 dark:text-slate-300 text-sm">{card.title}</h3>
						{#if adherenceHistory.length >= 2}
							{@const trend = (adherenceHistory[adherenceHistory.length - 1]?.adherenceRate ?? 0) - (adherenceHistory[0]?.adherenceRate ?? 0)}
							<span class="text-xs font-medium px-2 py-1 rounded-full {trend > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : trend < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}">
								{#if trend > 0}↗ +{trend.toFixed(0)}%{:else if trend < 0}↘ {trend.toFixed(0)}%{:else}→ Stabil{/if}
							</span>
						{/if}
					</div>
					<div class="flex items-end justify-between gap-4 flex-1">
						<div class="flex-shrink-0">
							<div class="text-4xl font-bold {card.accent}">{card.value}</div>
							<p class="text-sm text-gray-600 dark:text-slate-400 mt-1">{card.sub}</p>
							{#if adherenceHistory.length > 0}
								<p class="text-xs text-gray-500 dark:text-slate-500 mt-2">
									Ultimele {adherenceHistory.length} zile
								</p>
							{/if}
						</div>
						<div class="flex-1 flex flex-col gap-2">
							<div class="h-24 bg-gradient-to-r from-blue-100/30 to-blue-200/30 dark:from-blue-950/30 dark:to-blue-900/30 rounded-lg flex items-end justify-center gap-1 px-3 pb-2 relative group">
								{#each Array(7).fill(0).map((_, i) => adherenceHistory[i]) as dayData, i}
									{@const rate = dayData?.adherenceRate || 0}
									{@const height = Math.max(10, (rate / 100) * 70)}
									{@const barColor = rate >= 80 ? 'bg-green-500 dark:bg-green-400' : rate >= 60 ? 'bg-blue-400 dark:bg-blue-500' : rate >= 40 ? 'bg-yellow-500 dark:bg-yellow-400' : 'bg-red-400 dark:bg-red-500'}
									<div class="relative flex-1 flex flex-col items-center group/bar">
										<div 
											class={`w-full ${barColor} rounded-t transition-all duration-300 hover:brightness-110 cursor-pointer`}
											style="height: {height}px;"
											role="button"
											tabindex="0"
										></div>
										<div class="absolute bottom-full mb-2 hidden group-hover/bar:block bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded px-2 py-1 whitespace-nowrap z-10 shadow-lg">
											<div class="font-semibold">{rate}%</div>
											{#if dayData}
												<div class="text-[10px] opacity-80">{dayData.confirmed}/{dayData.scheduled}</div>
											{:else}
												<div class="text-[10px] opacity-80">Fără date</div>
											{/if}
										</div>
									</div>
								{/each}
							</div>
							<div class="flex justify-between text-xs text-gray-500 dark:text-slate-400 px-1">
								<span>L</span>
								<span>M</span>
								<span>M</span>
								<span>J</span>
								<span>V</span>
								<span>S</span>
								<span>D</span>
							</div>
						</div>
					</div>
				</div>
			{:else}
				{#if card.nextDose}
					<!-- Combined Today + Next Dose card -->
					<div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 md:p-5 shadow-sm dark:shadow-lg hover:shadow-md dark:hover:shadow-xl transition h-full flex flex-col justify-between">
						<div>
							<p class="text-sm text-gray-700 dark:text-slate-300 mb-1">{card.title}</p>
							<p class={`text-2xl md:text-3xl font-bold ${card.accent}`}>{card.value}</p>
							<p class="text-xs text-gray-600 dark:text-slate-400 mt-1">{card.sub}</p>
						</div>
						<div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
							<p class="text-xs text-gray-500 dark:text-slate-400 mb-1">Următoarea doză</p>
							<p class="text-sm font-semibold text-blue-600 dark:text-blue-400">{card.nextDose}</p>
						</div>
					</div>
				{:else}
					<Card title={card.title} value={card.value} sub={card.sub} accent={card.accent} ariaLabel={card.ariaLabel} />
				{/if}
			{/if}
		{/each}
	</div>

	<!-- Charts Grid -->
	<ChartsGroup bind:weeklyCanvas={weeklyChartCanvas} />
	</div>
{/if}
