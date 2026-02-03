<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Chart } from 'chart.js/auto';
	import { api, adminReportsApi } from '$lib/api/client';
	import { authStore, isPacient, isMedic } from '$lib/stores/auth';
	import { themeStore } from '$lib/stores/theme';
	import { goto } from '$app/navigation';
	import {
		isMedicationTaken,
		isMedicationSnoozed,
		getMedicationScheduledTime
	} from '$lib/utils/medications';
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
		Star,
		Activity
	} from '@lucide/svelte';
	import { getChartTheme, createTimeSeriesChart, type ChartTheme } from '$lib/utils/charts';
	import Card from '$lib/components/Card.svelte';
	import ActionButton from '$lib/components/ActionButton.svelte';
	import PatientsList from '$lib/components/PatientsList.svelte';
	import TreatmentsList from '$lib/components/TreatmentsList.svelte';
	import MedicationsList from '$lib/components/MedicationsList.svelte';
	import ChartsGroup from '$lib/components/ChartsGroup.svelte';
	import WelcomeCard from '$lib/components/WelcomeCard.svelte';
	import type {
		Medication,
		Treatment,
		Collaboration,
		AdminOverview,
		Stats,
		MedicStats,
		User as ApiUser
	} from '$lib/types/api';

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
			borderHover:
				'border-blue-400 dark:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10',
			iconBg: 'bg-blue-100 dark:bg-blue-900/30',
			iconColor: 'text-blue-600 dark:text-blue-400',
			icon: Plus
		},
		{
			label: 'Vezi Invitații',
			description: 'Gestionează colaborările',
			href: '/collaborations',
			borderHover:
				'border-green-400 dark:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/10',
			iconBg: 'bg-green-100 dark:bg-green-900/30',
			iconColor: 'text-green-600 dark:text-green-400',
			icon: UserCheck
		},
		{
			label: 'Mesaje',
			description: 'Comunică cu pacienții',
			href: '/chat',
			borderHover:
				'border-purple-400 dark:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/10',
			iconBg: 'bg-purple-100 dark:bg-purple-900/30',
			iconColor: 'text-purple-600 dark:text-purple-400',
			icon: MessageSquare
		}
	]);

	const adminCards = $derived(
		adminOverview
			? [
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
				]
			: []
	);

	function getAdminBorderClass(accent: string) {
		if (accent.includes('blue')) return 'border-l-blue-500';
		if (accent.includes('green')) return 'border-l-green-500';
		if (accent.includes('purple')) return 'border-l-purple-500';
		return 'border-l-orange-500';
	}

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
			return (
				(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ||
				document.documentElement.classList.contains('dark')
			);
		}
		return false;
	});

	const chartTheme: ChartTheme = $derived(getChartTheme(isDarkMode));

	const isAdmin = $derived($authStore.user?.role === 'admin');

	async function loadAdminOverview() {
		try {
			adminLoading = true;
			adminError = null;
			adminOverview = await adminReportsApi.getOverview();
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
				/* setTimeout(() => {
					// Logic removed as per cleanup
				}, 50); */
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

		if (weeklyChart) weeklyChart.destroy();
		window.removeEventListener('notification', handleNotification as EventListener);
		window.removeEventListener('new-message', handleNewMessage as EventListener);
	});

	function handleNotification(event: CustomEvent) {
		const detail = event.detail;
		if (
			detail?.type === 'reminder' ||
			detail?.type === 'treatment_update' ||
			detail?.type === 'alert'
		) {
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
			const user = (await api.getProfile()) as ApiUser & { id?: number };
			// normalize id for authStore consumers
			const normalizedId = user.id ?? user.userId;
			authStore.updateUser({
				id: normalizedId,
				email: user.email,
				fullName: user.fullName,
				role: user.role,
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
				const plans = (await api.getTreatments()) as Treatment[];
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
			const history = (await api.getMedicationHistoryAdherence(7)) as AdherenceRecord[];
			adherenceHistory = history.sort(
				(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
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
		nextDose = allDoneToday ? null : upcomingEntry?.med || latestOverdueEntry?.med || null;
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
			weeklyAdherence:
				adherenceHistory.length > 0
					? Math.round(
							adherenceHistory.reduce((sum: number, d) => sum + (d.adherenceRate ?? 0), 0) /
								adherenceHistory.length
						)
					: total
						? Math.round((taken / total) * 100)
						: 0
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
	let showRewardModal = $state(false);
	const displayStreak = $derived(streakBroken ? 0 : $authStore.user?.currentStreak || 0);
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
			const displayTime =
				nextDose.time ||
				scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
		const displayTime =
			nextDose.time || scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

			// Check if all doses are now completed and show reward modal
			if (allDoneToday && !showRewardModal) {
				showRewardModal = true;
			}
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
		const todayRate = stats.total > 0 ? Math.round((stats.taken / stats.total) * 100) : 0;

		return {
			labels: ['Astăzi'],
			data: [todayRate]
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
		<WelcomeCard
			name={$authStore.user?.fullName || ''}
			subtitle={`Ai grijă de ${medicStats.totalPatients} pacienți astăzi`}
		/>

		<!-- Quick Stats -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-4">
			{#each medicCards as card}
				<Card
					title={card.title}
					value={card.value}
					sub=""
					accent="text-gray-900 dark:text-slate-100"
					icon={card.icon}
					iconColor={card.iconColor}
					iconBg={card.iconBg}
					ariaLabel={card.ariaLabel}
				/>
			{/each}
		</div>

		<!-- Quick Actions -->
		<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
			{#each medicActions as action}
				<ActionButton
					href={action.href}
					label={action.label}
					description={action.description}
					icon={action.icon}
					iconBg={action.iconBg}
					iconColor={action.iconColor}
					borderHover={action.borderHover}
				/>
			{/each}
		</div>
		<!-- Patients List -->
		{#snippet patientsActions()}
			<button
				onclick={() => goto('/collaborations')}
				class="text-sm text-blue-600 hover:underline dark:text-blue-400">Vezi toți →</button
			>
		{/snippet}
		<PatientsList {loading} {patients} onView={viewPatient} actions={patientsActions} />

		<!-- Recent Treatments -->
		{#snippet treatmentsActions()}
			<button
				onclick={() => goto('/treatments')}
				class="text-sm text-blue-600 hover:underline dark:text-blue-400">Vezi toate →</button
			>
		{/snippet}
		<TreatmentsList {loading} {treatments} onView={viewTreatment} actions={treatmentsActions} />
	</div>
{:else if isAdmin}
	<!-- Admin Dashboard -->
	<div class="space-y-4 md:space-y-6">
		<!-- Header -->
		<div class="space-y-1">
			<h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-slate-100">
				Admin Dashboard
			</h1>
			<p class="text-sm font-medium text-gray-700 dark:text-slate-300">
				Prezentare generală a sistemului, activitate și conformitate
			</p>
		</div>

		{#if adminLoading}
			<div class="p-6 text-gray-900 dark:text-slate-100">Se încarcă rapoarte…</div>
		{:else if adminError}
			<div class="p-6 text-red-600 dark:text-red-400">{adminError}</div>
		{:else if adminOverview}
			<div class="space-y-4 md:space-y-6">
				<!-- KPI Cards Grid -->
				<div class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:grid-cols-4">
					{#each adminCards as card}
						<Card
							title={card.title}
							value={card.value}
							sub={card.sub}
							accent={card.accent}
							containerClass={`border-l-4 ${getAdminBorderClass(card.accent)}`}
						/>
					{/each}
				</div>

				<!-- Admin Modules Quick Links -->
				<div class="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<!-- Users Management Card -->
					<Card
						href="/admin/users"
						renderCustom
						ariaLabel="Gestionează Utilizatori: Vizualizează, editează și monitorizează"
						containerClass="group border-l-4 border-l-blue-500 p-6 hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 h-full flex flex-col"
					>
						<div class="mb-4 flex items-start justify-between gap-3">
							<Users class="h-14 w-14 flex-shrink-0 text-blue-600 dark:text-blue-400" />
							<ArrowRight
								class="h-5 w-5 flex-shrink-0 text-blue-400 transition-transform group-hover:translate-x-1 dark:text-blue-300"
							/>
						</div>
						<h3 class="mb-2 text-lg font-bold text-blue-800 dark:text-blue-200">Utilizatori</h3>
						<p class="text-sm text-slate-700 dark:text-slate-300">
							Vizualizează, editează și monitorizează conturi
						</p>
					</Card>

					<!-- Reports Card -->
					<Card
						href="/admin/reports"
						renderCustom
						ariaLabel="Rapoarte: Overview și rapoarte detaliate"
						containerClass="group border-l-4 border-l-emerald-500 p-6 hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 h-full flex flex-col"
					>
						<div class="mb-4 flex items-start justify-between gap-3">
							<BarChart3 class="h-14 w-14 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
							<ArrowRight
								class="h-5 w-5 flex-shrink-0 text-emerald-400 transition-transform group-hover:translate-x-1 dark:text-emerald-300"
							/>
						</div>
						<h3 class="mb-2 text-lg font-bold text-emerald-800 dark:text-emerald-200">Rapoarte</h3>
						<p class="text-sm text-slate-700 dark:text-slate-300">
							Overview și analize detaliate sistem
						</p>
					</Card>

					<!-- Monitoring Card -->
					<Card
						href="/admin/monitoring"
						renderCustom
						ariaLabel="Monitorizare: Metrici real-time și performanță sistem"
						containerClass="group border-l-4 border-l-purple-500 p-6 hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 h-full flex flex-col"
					>
						<div class="mb-4 flex items-start justify-between gap-3">
							<Activity class="h-14 w-14 flex-shrink-0 text-purple-600 dark:text-purple-400" />
							<ArrowRight
								class="h-5 w-5 flex-shrink-0 text-purple-400 transition-transform group-hover:translate-x-1 dark:text-purple-300"
							/>
						</div>
						<h3 class="mb-2 text-lg font-bold text-purple-800 dark:text-purple-200">
							Monitorizare
						</h3>
						<p class="text-sm text-slate-700 dark:text-slate-300">
							Metrici real-time și performanță sistem
						</p>
					</Card>
				</div>

				<!-- 2-Column Layout for Content Sections -->
				<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
					<!-- Left Column -->
					<div class="flex h-full flex-col gap-6">
						<!-- Users by Role -->
						<Card renderCustom containerClass="p-0 overflow-hidden h-full flex flex-col flex-[2]">
							<div
								class="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:border-slate-700"
							>
								<div>
									<h2
										class="flex items-center gap-2 text-base font-bold text-gray-900 sm:text-lg dark:text-slate-100"
									>
										<User class="h-5 w-5" /> Utilizatori după Rol
									</h2>
									<p class="mt-1 text-xs text-gray-600 dark:text-slate-400">
										Distribuție pe roluri sistem
									</p>
								</div>
								<a
									href="/admin/users"
									class="w-fit text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
									>Gestionează →</a
								>
							</div>
							<div class="flex-1 space-y-3 p-3 sm:p-4 md:p-6">
								{#if adminOverview.users.byRole && adminOverview.users.byRole.length > 0}
									{#each adminOverview.users.byRole as r}
										<div
											class="rounded-lg border border-slate-200/60 bg-white/70 p-3 transition-all hover:shadow-md sm:p-4 dark:border-slate-700/60 dark:bg-slate-800/60"
										>
											<div class="mb-2 flex items-center justify-between">
												<div
													class="flex items-center gap-2 font-medium text-gray-900 dark:text-slate-100"
												>
													{#if r.role === 'admin'}
														<Crown class="h-6 w-6" />
														<span class="text-sm sm:text-base">Administrator</span>
													{:else if r.role === 'medic'}
														<Stethoscope class="h-6 w-6" />
														<span class="text-sm sm:text-base">Medic</span>
													{:else}
														<UserCircle class="h-6 w-6" />
														<span class="text-sm sm:text-base">Pacient</span>
													{/if}
												</div>
												<div
													class="text-xl font-bold text-gray-900 sm:text-2xl dark:text-slate-100"
												>
													{r.count}
												</div>
											</div>
											<!-- Progress bar -->
											<div
												class="h-2 w-full overflow-hidden rounded-full bg-slate-200/70 sm:h-2.5 dark:bg-slate-700"
											>
												<div
													class="{r.role === 'admin'
														? 'bg-gradient-to-r from-purple-500 to-purple-600'
														: r.role === 'medic'
															? 'bg-gradient-to-r from-blue-500 to-blue-600'
															: 'bg-gradient-to-r from-green-500 to-green-600'} h-full rounded-full transition-all duration-500"
													style="width: {totalUsersByRole > 0
														? (r.count / totalUsersByRole) * 100
														: 0}%"
												></div>
											</div>
											<div class="mt-1.5 text-xs text-gray-600 dark:text-slate-300">
												{Math.round((r.count / totalUsersByRole) * 100)}% din total
											</div>
										</div>
									{/each}

									<!-- Summary -->
									<div class="mt-4 border-t border-slate-200/70 pt-3 dark:border-slate-800/70">
										<div class="flex items-center justify-between text-sm">
											<span class="text-gray-700 dark:text-slate-100">Total utilizatori:</span>
											<span class="font-bold text-gray-900 dark:text-slate-100"
												>{totalUsersByRole}</span
											>
										</div>
									</div>
								{:else}
									<div class="py-8 text-center text-gray-500 dark:text-slate-400">
										<Users class="mx-auto mb-2 h-12 w-12" />
										<p class="text-sm">Nu sunt utilizatori în sistem</p>
									</div>
								{/if}
							</div>
						</Card>
					</div>

					<!-- Right Column -->
					<div class="flex h-full flex-col gap-6">
						<!-- Collaborations -->
						<Card renderCustom containerClass="p-0 overflow-hidden h-full flex flex-col flex-[1.2]">
							<div
								class="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700"
							>
								<div>
									<h2
										class="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-slate-100"
									>
										<Users class="h-5 w-5" /> Status Colaborări
									</h2>
									<p class="mt-1 text-xs text-gray-600 dark:text-slate-400">
										Relații medic-pacient și acceptare
									</p>
								</div>
								<a
									href="/collaborations"
									class="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
									>Vezi toți →</a
								>
							</div>
							<div class="flex flex-1 flex-col gap-3 p-3 sm:p-4">
								{#if adminOverview.collaborations && adminOverview.collaborations.length > 0}
									<div class="grid gap-2">
										{#each adminOverview.collaborations as c}
											<div
												class="rounded-md border border-slate-200/60 bg-white/70 p-2 dark:border-slate-700/60 dark:bg-slate-800/60"
											>
												<div class="flex flex-col items-center gap-1.5 text-center">
													<div class="flex items-center gap-2">
														{#if c.status === 'pending'}
															<div
																class="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30"
															>
																<Clock class="h-4 w-4 text-yellow-700 dark:text-yellow-400" />
															</div>
															<span
																class="text-xs font-medium text-gray-900 sm:text-sm dark:text-slate-100"
																>În așteptare</span
															>
														{:else if c.status === 'accepted'}
															<div
																class="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30"
															>
																<CheckCircle2 class="h-4 w-4 text-green-700 dark:text-green-400" />
															</div>
															<span
																class="text-xs font-medium text-green-900 sm:text-sm dark:text-green-100"
																>Acceptate</span
															>
														{:else if c.status === 'rejected'}
															<div
																class="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30"
															>
																<AlertCircle class="h-4 w-4 text-red-700 dark:text-red-400" />
															</div>
															<span
																class="text-xs font-medium text-red-900 sm:text-sm dark:text-red-100"
																>Respinse</span
															>
														{:else}
															<div
																class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"
															>
																<span
																	class="text-xs font-semibold text-gray-700 dark:text-slate-200"
																	>?</span
																>
															</div>
															<span
																class="text-xs font-medium text-gray-900 sm:text-sm dark:text-slate-100"
																>{c.status}</span
															>
														{/if}
													</div>
													<span
														class="text-lg font-bold text-gray-900 sm:text-xl dark:text-slate-100"
														>{c.count}</span
													>
												</div>
												<!-- Progress bar with percentage -->
												<div
													class="h-2 w-full overflow-hidden rounded-full bg-slate-200/70 sm:h-2.5 dark:bg-slate-800"
												>
													<div
														class="{c.status === 'accepted'
															? 'bg-gradient-to-r from-green-500 to-green-600'
															: c.status === 'pending'
																? 'bg-gradient-to-r from-yellow-500 to-yellow-600'
																: 'bg-gradient-to-r from-red-500 to-red-600'} h-full rounded-full transition-all duration-500"
														style="width: {totalCollaborations > 0
															? (c.count / totalCollaborations) * 100
															: 0}%"
													></div>
												</div>
												<div
													class="text-center text-[11px] text-gray-700 sm:text-xs dark:text-slate-200"
												>
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
									</div>
								{:else}
									<div class="py-6 text-center text-gray-500 dark:text-slate-400">
										<HelpCircle class="mx-auto mb-2 h-12 w-12" />
										<p class="text-sm">Nicio colaborare în sistem</p>
									</div>
								{/if}

								{#if adminOverview.collaborations && adminOverview.collaborations.length > 0}
									<div
										class="mt-auto space-y-1 border-t border-slate-200/70 pt-3 text-[11px] sm:text-xs dark:border-slate-800/70"
									>
										<div class="flex justify-between">
											<span class="text-gray-700 dark:text-slate-300">Total colaborări:</span>
											<span class="font-semibold text-gray-900 dark:text-slate-100"
												>{totalCollaborations}</span
											>
										</div>
										<div class="flex justify-between">
											<span class="text-gray-700 dark:text-slate-300">Rata acceptare:</span>
											<span
												class="font-semibold {totalCollaborations > 0 &&
												acceptedCollaborations / totalCollaborations > 0.8
													? 'text-green-600 dark:text-green-400'
													: 'text-yellow-600 dark:text-yellow-400'}"
												>{Math.round(
													(acceptedCollaborations / (totalCollaborations || 1)) * 100
												)}%</span
											>
										</div>
									</div>
								{/if}
							</div>
						</Card>
					</div>
				</div>
			</div>
		{/if}
	</div>
{:else if $isPacient}
	<!-- Patient Dashboard -->
	<div
		class={`space-y-4 md:space-y-6 ${
			streakBroken ? 'rounded-3xl bg-slate-100/70 p-4 md:p-6 dark:bg-slate-900/60' : ''
		}`}
	>
		<!-- Welcome Card -->
		<WelcomeCard
			name={$authStore.user?.fullName || ''}
			title={allDoneToday
				? `Bun venit, ${$authStore.user?.fullName || ''}!`
				: streakBroken
					? `${$authStore.user?.fullName || ''}, streak pierdut`
					: countdownStatus === 'critical'
						? `${$authStore.user?.fullName || ''}, Streak în pericol!`
						: countdownStatus === 'warning'
							? `Bun venit, ${$authStore.user?.fullName || ''}!`
							: null}
			subtitle={allDoneToday
				? 'Ai îndeplinit toate misiunile!'
				: streakBroken
					? 'Timpul a trecut. Streak resetat la 0. Nu lăsa asta să devină un obicei...'
					: countdownStatus === 'critical'
						? `Nu strica progresul de ${displayStreak} zile!`
						: countdownStatus === 'warning'
							? 'Se apropie următoarea doză! Nu rata streakul!'
							: `${$authStore.user?.totalXp || 0} XP • Streak: ${displayStreak} zile`}
			tone={allDoneToday
				? 'celebrate'
				: streakBroken
					? 'sad'
					: countdownStatus === 'critical'
						? 'critical'
						: countdownStatus === 'warning'
							? 'warning'
							: 'default'}
		/>

		<!-- Streak Loss Penalty Alert -->
		{#if streakBroken}
			<Card
				renderCustom
				unstyled
				containerClass="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-l-4 border-l-red-600 dark:border-l-red-400 border border-red-200 dark:border-red-800 rounded-lg p-4 md:p-5 animate-pulse-alert"
			>
				<div class="flex items-start gap-4">
					<div class="mt-0.5 flex-shrink-0">
						<div
							class="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white dark:bg-red-500"
						>
							−
						</div>
					</div>
					<div class="flex-1">
						<h3 class="mb-1 font-bold text-red-900 dark:text-red-200">Streak pierdut!</h3>
						<p class="mb-2 text-sm text-red-800 dark:text-red-300">
							Ai pierdut streakul tău. Ca penalitate, o parte din XP-ul zilei a fost retras.
						</p>
						<div
							class="inline-block rounded bg-white/40 px-2 py-1 text-xs text-red-700 dark:bg-black/20 dark:text-red-400"
						>
							−10% XP din doze completate astazi
						</div>
					</div>
				</div>
			</Card>
		{:else if countdownStatus === 'critical'}
			<!-- Critical Warning -->
			<Card
				renderCustom
				unstyled
				containerClass="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-l-4 border-l-orange-600 dark:border-l-orange-400 border border-orange-200 dark:border-orange-800 rounded-lg p-4 md:p-5 animate-pulse"
			>
				<div class="flex items-start gap-3">
					<div class="flex-shrink-0">
						<AlertTriangle class="mt-0.5 h-5 w-5 text-orange-600 dark:text-orange-400" />
					</div>
					<div class="flex-1">
						<h3 class="mb-1 font-semibold text-orange-900 dark:text-orange-200">
							Streakul tău este în pericol!
						</h3>
						<p class="text-sm text-orange-800 dark:text-orange-300">
							Ai puțin timp pentru a confirma doza programată înainte să-ți pierzi streakul.
						</p>
					</div>
				</div>
			</Card>
		{/if}

		<!-- Medications List -->
		<MedicationsList
			{loading}
			medications={todayMedications}
			isTakenFn={isMedicationTaken}
			isSnoozedFn={(m: Medication) => isMedicationSnoozed(m)}
			onConfirm={confirmMedication}
			onSnooze={snoozeMedication}
			celebrate={allDoneToday}
			streak={displayStreak}
			maxStreak={$authStore.user?.longestStreak || 0}
			{countdownText}
			{countdownProgress}
			{countdownStatus}
			nextDoseId={nextDose?.doseId ?? null}
			muted={streakBroken}
		/>

		<!-- Quick Stats -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-3">
			{#each patientCards as card, idx}
				{#if idx === 0}
					<!-- Conformitate card -->
					<Card renderCustom containerClass="sm:col-span-2 p-6">
						<div class="mb-3 flex items-center justify-between">
							<h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300">{card.title}</h3>
							{#if adherenceHistory.length >= 2}
								{@const trend =
									(adherenceHistory[adherenceHistory.length - 1]?.adherenceRate ?? 0) -
									(adherenceHistory[0]?.adherenceRate ?? 0)}
								<span
									class="rounded-full px-2 py-1 text-xs font-medium {trend > 0
										? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
										: trend < 0
											? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
											: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}"
								>
									{#if trend > 0}↗ +{trend.toFixed(0)}%{:else if trend < 0}↘ {trend.toFixed(
											0
										)}%{:else}→ Stabil{/if}
								</span>
							{/if}
						</div>
						<div class="flex flex-1 items-end justify-between gap-4">
							<div class="flex-shrink-0">
								<div class="text-4xl font-bold {card.accent}">{card.value}</div>
								<p class="mt-1 text-sm text-gray-600 dark:text-slate-400">{card.sub}</p>
								{#if adherenceHistory.length > 0}
									<p class="mt-2 text-xs text-gray-500 dark:text-slate-500">
										Ultimele {adherenceHistory.length} zile
									</p>
								{/if}
							</div>
							<div class="flex flex-1 flex-col gap-2">
								<div
									class="group relative flex h-24 items-end justify-center gap-1 rounded-lg bg-gradient-to-r from-blue-100/30 to-blue-200/30 px-3 pb-2 dark:from-blue-950/30 dark:to-blue-900/30"
								>
									{#each Array(7)
										.fill(0)
										.map((_, i) => adherenceHistory[i]) as dayData, i}
										{@const rate = dayData?.adherenceRate || 0}
										{@const height = Math.max(10, (rate / 100) * 70)}
										{@const barColor =
											rate >= 80
												? 'bg-green-500 dark:bg-green-400'
												: rate >= 60
													? 'bg-blue-400 dark:bg-blue-500'
													: rate >= 40
														? 'bg-yellow-500 dark:bg-yellow-400'
														: 'bg-red-400 dark:bg-red-500'}
										<div class="group/bar relative flex flex-1 flex-col items-center">
											<div
												class={`w-full ${barColor} cursor-pointer rounded-t transition-all duration-300 hover:brightness-110`}
												style="height: {height}px;"
												role="button"
												tabindex="0"
											></div>
											<div
												class="absolute bottom-full z-10 mb-2 hidden rounded bg-gray-900 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg group-hover/bar:block dark:bg-gray-100 dark:text-gray-900"
											>
												<div class="font-semibold">{rate}%</div>
												{#if dayData}
													<div class="text-[10px] opacity-80">
														{dayData.confirmed}/{dayData.scheduled}
													</div>
												{:else}
													<div class="text-[10px] opacity-80">Fără date</div>
												{/if}
											</div>
										</div>
									{/each}
								</div>
								<div class="flex justify-between px-1 text-xs text-gray-500 dark:text-slate-400">
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
					</Card>
				{:else if card.nextDose}
					<!-- Combined Today + Next Dose card -->
					<Card renderCustom containerClass="p-4 md:p-5">
						<div>
							<p class="mb-1 text-sm text-gray-700 dark:text-slate-300">{card.title}</p>
							<p class={`text-2xl font-bold md:text-3xl ${card.accent}`}>{card.value}</p>
							<p class="mt-1 text-xs text-gray-600 dark:text-slate-400">{card.sub}</p>
						</div>
						<div class="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
							<p class="mb-1 text-xs text-gray-500 dark:text-slate-400">Următoarea doză</p>
							<p class="text-sm font-semibold text-blue-600 dark:text-blue-400">{card.nextDose}</p>
						</div>
					</Card>
				{:else}
					<Card
						title={card.title}
						value={card.value}
						sub={card.sub}
						accent={card.accent}
						ariaLabel={card.ariaLabel}
					/>
				{/if}
			{/each}
		</div>

		<!-- Charts Grid -->
		<ChartsGroup bind:weeklyCanvas={weeklyChartCanvas} />
	</div>
{/if}

<!-- Daily XP Reward Modal - Outside all sections to overlay entire viewport -->
{#if showRewardModal}
	<div
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-200"
		role="dialog"
		aria-modal="true"
		aria-labelledby="reward-title"
	>
		<div
			class="relative mx-4 w-11/12 max-w-md overflow-hidden rounded-2xl border-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-amber-50 p-8 shadow-2xl dark:border-yellow-800 dark:from-yellow-950/30 dark:to-amber-950/30"
		>
			<!-- Animated background -->
			<div class="absolute inset-0 opacity-20">
				<div
					class="absolute top-0 left-0 h-40 w-40 animate-pulse rounded-full bg-yellow-400 blur-3xl"
				></div>
				<div
					class="absolute right-0 bottom-0 h-40 w-40 animate-pulse rounded-full bg-amber-400 blur-3xl"
				></div>
			</div>

			<div class="relative space-y-4 text-center">
				<div class="animate-bounce text-6xl drop-shadow-lg">🎉</div>
				<div>
					<p
						id="reward-title"
						class="mb-2 inline-flex items-center justify-center gap-2 text-sm font-semibold text-gray-800 dark:text-yellow-300"
					>
						<Star class="h-5 w-5 animate-bounce" />
						Recompensă de astazi
					</p>
					<p class="mb-3 text-5xl font-black text-gray-900 dark:text-yellow-100">+50 XP</p>
					<p class="text-base text-gray-700 dark:text-yellow-300">
						Felicitări! Ai îndeplinit toate misiunile!
					</p>
				</div>

				<button
					type="button"
					onclick={() => (showRewardModal = false)}
					class="mt-6 rounded-lg bg-gradient-to-r from-yellow-600 to-amber-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:from-yellow-700 hover:to-amber-700 active:scale-95"
				>
					Închide
				</button>
			</div>
		</div>
	</div>
{/if}
