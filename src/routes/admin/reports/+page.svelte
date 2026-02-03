<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { adminReportsApi } from '$lib/api/client';
	import { authStore } from '$lib/stores/auth';
	import { toast } from '$lib/utils/toast';
	import Card from '$lib/components/Card.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import { BarChart3, FileText, Users, Pill, CheckCircle2, Zap, Check } from '@lucide/svelte';
	import { createPieChart, createBarChart, createLineChart } from '$lib/utils/charts';

	let overview = $state<any | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let exporting = $state<string | null>(null);
	let isAdmin = $derived($authStore.user?.role === 'admin');

	onMount(async () => {
		if (!isAdmin) {
			goto('/dashboard');
			return;
		}
		try {
			loading = true;
			overview = await adminReportsApi.getOverview();
		} catch (e: any) {
			error = e?.message || 'Nu s-au putut încărca rapoartele.';
		} finally {
			loading = false;
		}
	});

	function initCharts() {
		if (!overview) return;

		try {
			// Users pie chart
			const usersCtx = document.getElementById('usersPieChart') as HTMLCanvasElement;
			if (usersCtx) {
				const userData = overview.users.byRole.map((r: any) => ({
					label: r.role.charAt(0).toUpperCase() + r.role.slice(1),
					value: r.count
				}));
				createPieChart(usersCtx.getContext('2d')!, userData, 'Utilizatori după Rol');
			}

			// Treatments bar chart
			const treatmentsCtx = document.getElementById('treatmentsBarChart') as HTMLCanvasElement;
			if (treatmentsCtx) {
				createBarChart(
					treatmentsCtx.getContext('2d')!,
					['Activ', 'Inactiv'],
					[{
						label: 'Planuri de Tratament',
						data: [overview.treatments.active, overview.treatments.inactive]
					}],
					'Starea Planurilor de Tratament'
				);
			}

			// Adherence line chart
			const adherenceCtx = document.getElementById('adherenceLineChart') as HTMLCanvasElement;
			if (adherenceCtx) {
				createLineChart(
					adherenceCtx.getContext('2d')!,
					['Ultima 7 zile', 'Ultima 30 zile'],
					[{
						label: 'Rata Aderență (%)',
						data: [
							Math.round(overview.adherence.last7Days.rate * 100),
							Math.round(overview.adherence.last30Days.rate * 100)
						]
					}],
					'Aderență Tratament'
				);
			}
		} catch (err) {
			console.error('Error initializing charts:', err);
		}
	}

	$effect(() => {
		if (overview && loading === false) {
			initCharts();
		}
	});

	async function handleAsyncExport(type: 'users' | 'treatments' | 'doses' | 'full_system') {
		try {
			exporting = type;
			await adminReportsApi.createReportJob(type);
			toast.success(`Job ${type} creat! Redirecționare la job-uri...`);
			setTimeout(() => goto('/admin/reports/jobs'), 1500);
		} catch (err: any) {
			console.error('Create job error:', err);
			toast.error(`Eroare la crearea job-ului ${type}`);
		} finally {
			exporting = null;
		}
	}

	function formatPercent(value: number) {
		return `${Math.round((value || 0) * 100)}%`;
	}
</script>

<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-4 sm:space-y-6">
	<!-- Header Section -->
	<div class="space-y-3 sm:space-y-4">
		<div class="space-y-1">
			<h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2"><BarChart3 class="w-8 h-8" /> Rapoarte Admin</h1>
			<p class="text-sm sm:text-base text-gray-900 dark:text-slate-100 font-medium">Overview utilizatori, colaborări și aderență cu grafice și export.</p>
		</div>
		
		
		<!-- Async Report Jobs Section -->
		<div class="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div class="flex items-start gap-3">
					<Zap class="w-6 h-6" />
					<div>
						<h3 class="font-semibold text-gray-900 dark:text-slate-100">Rapoarte Asincrone</h3>
						<p class="text-xs sm:text-sm text-gray-700 dark:text-slate-300 mt-0.5">
							Generează rapoarte mari în background. Recomandă pentru volume mari de date.
						</p>
					</div>
				</div>
				<a
					href="/admin/reports/jobs"
					class="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium text-sm whitespace-nowrap"
				>
					<FileText class="w-5 h-5" />
					<span>Gestionează Job-uri</span>
				</a>
			</div>
		</div>
	</div>

	{#if loading}
		<div class="flex justify-center items-center py-16">
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
		</div>
	{:else if error}
		<Alert containerClass="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg">
			{error}
		</Alert>
	{:else if overview}
		<!-- Charts Row -->
		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			<Card renderCustom unstyled containerClass="bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-xl p-6 shadow-md">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2"><Users class="w-5 h-5" /> Utilizatori după Rol</h2>
				<canvas id="usersPieChart"></canvas>
			</Card>

			<Card renderCustom unstyled containerClass="bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-xl p-6 shadow-md">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2"><FileText class="w-5 h-5" /> Planuri Tratament</h2>
				<canvas id="treatmentsBarChart"></canvas>
			</Card>

			<Card renderCustom unstyled containerClass="bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-xl p-6 shadow-md">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2"><BarChart3 class="w-5 h-5" /> Aderență</h2>
				<canvas id="adherenceLineChart"></canvas>
			</Card>
		</div>

		<!-- Stats Cards -->
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
			<Card renderCustom unstyled containerClass="bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 shadow-md">
				<div class="flex items-center gap-1.5 sm:gap-2 mb-2">
					<Users class="w-5 h-5" />
					<h3 class="text-xs sm:text-sm font-semibold text-gray-700 dark:text-slate-300 truncate">Utilizatori</h3>
				</div>
				<p class="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-slate-100 mb-1">{(overview.users.active ?? 0) + (overview.users.inactive ?? 0)}</p>
				<p class="text-xs text-green-600 dark:text-green-400 truncate flex items-center gap-1">
					<Check class="w-3 h-3" />
					{overview.users.active ?? 0} activi
				</p>
			</Card>

			<Card renderCustom unstyled containerClass="bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 shadow-md">
				<div class="flex items-center gap-1.5 sm:gap-2 mb-2">
					<FileText class="w-5 h-5" />
					<h3 class="text-xs sm:text-sm font-semibold text-gray-700 dark:text-slate-300 truncate">Tratamente</h3>
				</div>
				<p class="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-slate-100 mb-1">{overview.treatments.total ?? 0}</p>
				<p class="text-xs text-blue-600 dark:text-blue-400 truncate flex items-center gap-1">
					<Check class="w-3 h-3" />
					{overview.treatments.active ?? 0} active
				</p>
			</Card>

			<Card renderCustom unstyled containerClass="bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 shadow-md">
				<div class="flex items-center gap-1.5 sm:gap-2 mb-2">
					<Pill class="w-5 h-5" />
					<h3 class="text-xs sm:text-sm font-semibold text-gray-700 dark:text-slate-300 truncate">Doze</h3>
				</div>
				<p class="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-slate-100 mb-1">{overview.doses.total ?? 0}</p>
				<p class="text-xs text-gray-700 dark:text-slate-300 truncate">Total sistem</p>
			</Card>

			<Card renderCustom unstyled containerClass="bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 shadow-md">
				<div class="flex items-center gap-1.5 sm:gap-2 mb-2">
					<CheckCircle2 class="w-5 h-5" />
					<h3 class="text-xs sm:text-sm font-semibold text-gray-700 dark:text-slate-300 truncate">Aderență</h3>
				</div>
				<p class="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-slate-100 mb-1">{formatPercent(overview.adherence.last30Days.rate)}</p>
				<p class="text-xs text-gray-700 dark:text-slate-300 truncate">{overview.adherence.last30Days.confirmed}/{overview.adherence.last30Days.scheduled} doze</p>
			</Card>
		</div>

		<!-- Detailed Tables -->
		<div class="grid gap-6 md:grid-cols-2">
			<Card renderCustom unstyled containerClass="bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-xl p-6 shadow-md">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2"><Users class="w-5 h-5" /> Utilizatori după Rol</h2>
				<div class="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700">
					<table class="min-w-full text-sm">
						<thead class="bg-slate-50/80 dark:bg-slate-900/50 text-gray-700 dark:text-slate-300 uppercase tracking-wide text-xs">
							<tr>
								<th class="px-4 py-3 text-left">Rol</th>
								<th class="px-4 py-3 text-right">Număr</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 dark:divide-slate-700 text-gray-900 dark:text-slate-100">
							{#each overview.users.byRole as row}
								<tr class="hover:bg-gray-50 dark:hover:bg-slate-700/30">
									<td class="px-4 py-3 capitalize font-medium">{row.role}</td>
									<td class="px-4 py-3 text-right font-semibold">{row.count}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Card>

			<Card renderCustom unstyled containerClass="bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-xl p-6 shadow-md">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2"><Users class="w-5 h-5" /> Colaborări după Status</h2>
				<div class="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700">
					<table class="min-w-full text-sm">
						<thead class="bg-slate-50/80 dark:bg-slate-900/50 text-gray-700 dark:text-slate-300 uppercase tracking-wide text-xs">
							<tr>
								<th class="px-4 py-3 text-left">Status</th>
								<th class="px-4 py-3 text-right">Număr</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 dark:divide-slate-700 text-gray-900 dark:text-slate-100">
							{#each overview.collaborations as row}
								<tr class="hover:bg-gray-50 dark:hover:bg-slate-700/30">
									<td class="px-4 py-3 capitalize font-medium">{row.status}</td>
									<td class="px-4 py-3 text-right font-semibold">{row.count}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Card>
		</div>

		<!-- Adherence Details -->
		<Card renderCustom unstyled containerClass="bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-xl p-6 shadow-md">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2"><BarChart3 class="w-5 h-5" /> Detalii Aderență</h2>
			<div class="grid gap-4 md:grid-cols-2">
				<div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
					<p class="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Ultima 7 zile</p>
					<p class="text-2xl font-bold text-blue-900 dark:text-blue-100">{formatPercent(overview.adherence.last7Days.rate)}</p>
					<p class="text-xs text-blue-700 dark:text-blue-300 mt-2">
						{overview.adherence.last7Days.confirmed} confirmate din {overview.adherence.last7Days.scheduled} programate
					</p>
				</div>
				<div class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
					<p class="text-sm font-semibold text-green-900 dark:text-green-300 mb-2">Ultima 30 zile</p>
					<p class="text-2xl font-bold text-green-900 dark:text-green-100">{formatPercent(overview.adherence.last30Days.rate)}</p>
					<p class="text-xs text-green-700 dark:text-green-300 mt-2">
						{overview.adherence.last30Days.confirmed} confirmate din {overview.adherence.last30Days.scheduled} programate
					</p>
				</div>
				</div>
			</Card>
{/if}
</main>