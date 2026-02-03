<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { adminReportsApi } from '$lib/api/client';
	import { authStore } from '$lib/stores/auth';
	import Card from '$lib/components/Card.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import {
		Activity,
		AlertCircle,
		Zap,
		Users,
		TrendingUp,
		RotateCcw,
		Cpu,
		HardDrive,
		Clock,
		Database,
		Server
	} from '@lucide/svelte';
	import Chart from 'chart.js/auto';

	let overview = $state<any | null>(null);
	let metrics = $state<any | null>(null);
	let queryPerformance = $state<any | null>(null);
	let systemHealth = $state<any | null>(null);
	let loading = $state(true);
	let refreshing = $state(false);
	let error = $state<string | null>(null);
	let isAdmin = $derived($authStore.user?.role === 'admin');

	let endpointChart: Chart | null = null;
	let endpointCanvas = $state<HTMLCanvasElement>();

	async function loadData() {
		try {
			refreshing = true;
			const [overviewData, metricsData, queryData, healthData] = await Promise.all([
				adminReportsApi.getOverview().catch(() => null),
				adminReportsApi.getMetrics().catch(() => null),
				adminReportsApi.getQueryPerformance().catch(() => null),
				adminReportsApi.getSystemHealth().catch(() => null)
			]);

			overview = overviewData;
			metrics = metricsData;
			queryPerformance = queryData;
			systemHealth = healthData;
			error = null;

			updateCharts();
		} catch (e: any) {
			error = e?.message || 'Nu s-au putut încărca datele de monitorizare.';
		} finally {
			refreshing = false;
			loading = false;
		}
	}

	function updateCharts() {
		if (!endpointCanvas || !metrics?.summary) return;

		const topEndpoints = Object.entries(metrics.summary)
			.sort(([, a]: any, [, b]: any) => b.avgDuration - a.avgDuration)
			.slice(0, 5);

		if (endpointChart) endpointChart.destroy();

		endpointChart = new Chart(endpointCanvas, {
			type: 'bar',
			data: {
				labels: topEndpoints.map(([path]) => path),
				datasets: [
					{
						label: 'Medie Durată (ms)',
						data: topEndpoints.map(([, stats]: any) => stats.avgDuration),
						backgroundColor: 'rgba(99, 102, 241, 0.5)',
						borderColor: 'rgb(99, 102, 241)',
						borderWidth: 1
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false },
					title: { display: true, text: 'Top 5 cele mai lente endpoint-uri' }
				},
				scales: {
					y: { beginAtZero: true, title: { display: true, text: 'ms' } }
				}
			}
		});
	}

	async function clearMetrics() {
		try {
			await adminReportsApi.clearQueryMetrics();
			loadData();
		} catch (e: any) {
			error = e?.message || 'Nu s-au putut șterge metricile.';
		}
	}

	function formatUptime(seconds: number): string {
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		if (days > 0) return `${days}z ${hours}h`;
		return `${hours}h ${minutes}m`;
	}

	function formatBytes(bytes: number): string {
		const gb = bytes / (1024 * 1024 * 1024);
		return `${gb.toFixed(2)} GB`;
	}

	onMount(async () => {
		if (!isAdmin) {
			goto('/dashboard');
			return;
		}
		await loadData();
	});

	$effect(() => {
		// Auto-refresh every 30 seconds
		const interval = setInterval(loadData, 30000);
		return () => clearInterval(interval);
	});

	onDestroy(() => {
		if (endpointChart) endpointChart.destroy();
	});

	function getSlowQueryCount(): number {
		if (!queryPerformance?.recentQueries) return 0;
		return queryPerformance.recentQueries.filter((q: any) => q.duration > 1000).length;
	}

	function getSlowEndpointCount(): number {
		if (!metrics?.summary) return 0;
		return Object.values(metrics.summary).filter((s: any) => s.avgDuration > 500).length;
	}
</script>

<div class="space-y-4 md:space-y-6">
	<div class="mx-auto max-w-7xl">
		<!-- Header -->
		<div class="mb-4 flex flex-col gap-4 md:mb-6 md:flex-row md:items-center md:justify-between">
			<div class="space-y-1">
				<h1
					class="flex items-center gap-3 text-3xl font-bold tracking-tight text-gray-900 dark:text-slate-100"
				>
					<Activity class="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
					Monitorizare Sistem
				</h1>
				<p class="text-sm font-medium text-gray-700 dark:text-slate-300">
					Real-time metrics, system health și performanță
				</p>
			</div>
			<div class="flex gap-2">
				<button
					onclick={loadData}
					disabled={refreshing}
					class="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
				>
					<div class:animate-spin={refreshing}>
						<RotateCcw class="h-4 w-4" />
					</div>
					{refreshing ? 'Se reîncarcă...' : 'Reîncarcă'}
				</button>
			</div>
		</div>

		<div class="space-y-4 md:space-y-6">
			<!-- Error Alert -->
			{#if error}
				<Alert type="error" containerClass="mb-6">
					{error}
				</Alert>
			{/if}

			{#if loading}
				<div class="flex items-center justify-center py-12">
					<div class="text-center">
						<div class="mb-4 inline-block animate-spin">
							<div
								class="h-12 w-12 rounded-full border-4 border-indigo-200 border-t-indigo-600"
							></div>
						</div>
						<p class="text-slate-600 dark:text-slate-400">Se încarcă datele de monitorizare...</p>
					</div>
				</div>
			{:else}
				<!-- System Health -->
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:grid-cols-4">
					<Card
						renderCustom
						containerClass="bg-gradient-to-br from-indigo-50 to-white dark:from-slate-800 dark:to-slate-700"
					>
						<div class="flex items-start justify-between">
							<div>
								<p class="text-sm font-medium text-slate-600 dark:text-slate-400">CPU Load</p>
								<div class="mt-2 flex items-baseline gap-2">
									<p class="text-2xl font-bold text-slate-900 dark:text-white">
										{systemHealth?.system?.cpu?.loadAvg[0]?.toFixed(2) || '0.00'}
									</p>
									<span class="text-xs text-slate-500">1 min</span>
								</div>
								<p class="mt-1 text-xs text-slate-500 dark:text-slate-500">
									{systemHealth?.system?.cpu?.cores || 0} cores ({systemHealth?.system?.cpu
										?.model || 'Unknown'})
								</p>
							</div>
							<Cpu class="h-8 w-8 text-indigo-500 opacity-75" />
						</div>
					</Card>

					<Card
						renderCustom
						containerClass="bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-700"
					>
						<div class="flex items-start justify-between">
							<div>
								<p class="text-sm font-medium text-slate-600 dark:text-slate-400">Memorie</p>
								<div class="mt-2 flex items-baseline gap-2">
									<p class="text-2xl font-bold text-slate-900 dark:text-white">
										{systemHealth?.system?.memory?.percentage || 0}%
									</p>
									<span class="text-xs text-slate-500">utilizat</span>
								</div>
								<p class="mt-1 text-xs text-slate-500 dark:text-slate-500">
									{formatBytes(systemHealth?.system?.memory?.used || 0)} / {formatBytes(
										systemHealth?.system?.memory?.total || 0
									)}
								</p>
							</div>
							<HardDrive class="h-8 w-8 text-blue-500 opacity-75" />
						</div>
					</Card>

					<Card
						renderCustom
						containerClass="bg-gradient-to-br from-emerald-50 to-white dark:from-slate-800 dark:to-slate-700"
					>
						<div class="flex items-start justify-between">
							<div>
								<p class="text-sm font-medium text-slate-600 dark:text-slate-400">Uptime</p>
								<div class="mt-2 flex items-baseline gap-2">
									<p class="text-2xl font-bold text-slate-900 dark:text-white">
										{formatUptime(systemHealth?.system?.uptime || 0)}
									</p>
								</div>
								<p class="mt-1 text-xs text-slate-500 dark:text-slate-500">
									{systemHealth?.system?.platform || 'linux'}
									{systemHealth?.system?.release}
								</p>
							</div>
							<Clock class="h-8 w-8 text-emerald-500 opacity-75" />
						</div>
					</Card>

					<Card
						renderCustom
						containerClass="bg-gradient-to-br from-violet-50 to-white dark:from-slate-800 dark:to-slate-700"
					>
						<div class="flex items-start justify-between">
							<div>
								<p class="text-sm font-medium text-slate-600 dark:text-slate-400">Database</p>
								<div class="mt-2 flex items-baseline gap-2">
									<p class="text-2xl font-bold text-slate-900 dark:text-white">
										{systemHealth?.db?.totalCount || 0}
									</p>
									<span class="text-xs text-slate-500">connections</span>
								</div>
								<p class="mt-1 text-xs text-slate-500 dark:text-slate-500">
									{systemHealth?.db?.idleCount || 0} idle, {systemHealth?.db?.waitingCount || 0} waiting
								</p>
							</div>
							<Database class="h-8 w-8 text-violet-500 opacity-75" />
						</div>
					</Card>
				</div>

				<!-- Key Metrics -->
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:grid-cols-4">
					<!-- Active Users -->
					<Card renderCustom containerClass="border-l-4 border-l-blue-500">
						<div class="flex items-start justify-between">
							<div>
								<p class="text-sm font-medium text-slate-600 dark:text-slate-400">
									Utilizatori Activi
								</p>
								<p class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
									{overview?.activeUsers?.today || 0}
								</p>
								<p class="mt-1 text-xs text-slate-500 dark:text-slate-500">
									{overview?.users?.total || 0} total
								</p>
							</div>
							<Users class="h-8 w-8 text-blue-500 opacity-50" />
						</div>
					</Card>

					<!-- Total Requests -->
					<Card renderCustom containerClass="border-l-4 border-l-emerald-500">
						<div class="flex items-start justify-between">
							<div>
								<p class="text-sm font-medium text-slate-600 dark:text-slate-400">Total Cereri</p>
								<p class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
									{metrics?.totalRequests || 0}
								</p>
								<p class="mt-1 text-xs text-slate-500 dark:text-slate-500">Ultimele 50 afișate</p>
							</div>
							<TrendingUp class="h-8 w-8 text-green-500 opacity-50" />
						</div>
					</Card>

					<!-- Slow Queries -->
					<Card renderCustom containerClass="border-l-4 border-l-amber-500">
						<div class="flex items-start justify-between">
							<div>
								<p class="text-sm font-medium text-slate-600 dark:text-slate-400">
									Queries Lente (&gt;1s)
								</p>
								<p class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
									{getSlowQueryCount()}
								</p>
								<p class="mt-1 text-xs text-slate-500 dark:text-slate-500">
									{queryPerformance?.recentQueries?.length || 0} queries recent
								</p>
							</div>
							<Zap class="h-8 w-8 text-yellow-500 opacity-50" />
						</div>
					</Card>

					<!-- Slow Endpoints -->
					<Card renderCustom containerClass="border-l-4 border-l-red-500">
						<div class="flex items-start justify-between">
							<div>
								<p class="text-sm font-medium text-slate-600 dark:text-slate-400">
									Endpoint-uri Lente (&gt;500ms)
								</p>
								<p class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
									{getSlowEndpointCount()}
								</p>
								<p class="mt-1 text-xs text-slate-500 dark:text-slate-500">
									{Object.keys(metrics?.summary || {}).length} endpoint-uri total
								</p>
							</div>
							<AlertCircle class="h-8 w-8 text-red-500 opacity-50" />
						</div>
					</Card>
				</div>

				<!-- Charts & Detailed Tables -->
				<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
					<!-- User Activity Table -->
					{#if overview?.activeUsers}
						<Card renderCustom containerClass="p-0 overflow-hidden h-[400px] flex flex-col">
							<div class="border-b border-slate-200 p-4 sm:p-6 dark:border-slate-700">
								<h2
									class="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-slate-100"
								>
									<Users class="h-5 w-5 text-blue-600" />
									Detaliere Activitate
								</h2>
							</div>
							<div class="overflow-y-auto p-4 sm:p-6">
								<div class="grid grid-cols-2 gap-4">
									<div class="rounded-lg bg-slate-50 p-4 dark:bg-slate-700">
										<p class="text-xs font-medium text-slate-600 dark:text-slate-400">Astăzi</p>
										<p class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
											{overview.activeUsers.today}
										</p>
									</div>
									<div class="rounded-lg bg-slate-50 p-4 dark:bg-slate-700">
										<p class="text-xs font-medium text-slate-600 dark:text-slate-400">Săptămâna</p>
										<p class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
											{overview.activeUsers.week}
										</p>
									</div>
									<div class="rounded-lg bg-slate-50 p-4 dark:bg-slate-700">
										<p class="text-xs font-medium text-slate-600 dark:text-slate-400">Luna</p>
										<p class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
											{overview.activeUsers.month}
										</p>
									</div>
									<div class="rounded-lg bg-slate-50 p-4 dark:bg-slate-700">
										<p class="text-xs font-medium text-slate-600 dark:text-slate-400">Rate Activ</p>
										<p class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
											{overview.users.total
												? Math.round((overview.activeUsers.today / overview.users.total) * 100)
												: 0}%
										</p>
									</div>
								</div>
							</div>
						</Card>
					{/if}
				</div>

				<!-- Endpoint Performance Table -->
				{#if metrics?.summary && Object.keys(metrics.summary).length > 0}
					<Card renderCustom containerClass="p-0 overflow-hidden">
						<div class="border-b border-slate-200 p-4 sm:p-6 dark:border-slate-700">
							<h2
								class="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-slate-100"
							>
								<Server class="h-5 w-5 text-green-600" />
								Performanță Endpoint-uri
							</h2>
						</div>
						<div class="p-4 sm:p-6">
							<div class="overflow-x-auto">
								<table class="w-full text-sm">
									<thead>
										<tr class="border-b border-slate-200 dark:border-slate-700">
											<th
												class="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300"
												>Endpoint</th
											>
											<th
												class="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300"
												>Cereri</th
											>
											<th
												class="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300"
												>Avg (ms)</th
											>
											<th
												class="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300"
												>Min (ms)</th
											>
											<th
												class="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300"
												>Max (ms)</th
											>
										</tr>
									</thead>
									<tbody>
										{#each Object.entries(metrics.summary)
											.sort(([, a]: any, [, b]: any) => b.avgDuration - a.avgDuration)
											.slice(0, 15) as [endpoint, stats]}
											{@const s = stats as any}
											<tr
												class="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50"
											>
												<td class="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
													{endpoint}
												</td>
												<td class="px-4 py-3 text-right text-slate-900 dark:text-white"
													>{s.count}</td
												>
												<td class="px-4 py-3 text-right">
													<span
														class="inline-block rounded px-2 py-1 {s.avgDuration > 500
															? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
															: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'} font-semibold"
													>
														{s.avgDuration}
													</span>
												</td>
												<td class="px-4 py-3 text-right text-slate-600 dark:text-slate-400"
													>{s.minDuration}</td
												>
												<td class="px-4 py-3 text-right text-slate-600 dark:text-slate-400"
													>{s.maxDuration}</td
												>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					</Card>
				{/if}

				<!-- Query Performance -->
				{#if queryPerformance?.recentQueries && queryPerformance.recentQueries.length > 0}
					<Card renderCustom containerClass="p-0 overflow-hidden">
						<div
							class="flex items-center justify-between gap-3 border-b border-slate-200 p-4 sm:p-6 dark:border-slate-700"
						>
							<h2
								class="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-slate-100"
							>
								<Zap class="h-5 w-5 text-yellow-600" />
								Query Performance (Ultimele 10)
							</h2>
							<button
								onclick={clearMetrics}
								class="rounded bg-slate-100 px-3 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
							>
								Șterge Metrice
							</button>
						</div>
						<div class="p-4 sm:p-6">
							<div class="max-h-96 space-y-2 overflow-y-auto">
								{#each queryPerformance.recentQueries as query, i}
									<div
										class="flex items-center gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-700/50"
									>
										<div class="min-w-0 flex-1">
											<p class="truncate font-mono text-xs text-slate-600 dark:text-slate-400">
												{query.query.substring(0, 60)}...
											</p>
											<p class="mt-1 text-xs text-slate-500 dark:text-slate-500">
												{new Date(query.timestamp).toLocaleTimeString('ro-RO')}
											</p>
										</div>
										<div class="flex-shrink-0 text-right">
											<span
												class="inline-block rounded px-2 py-1 font-bold {query.duration > 1000
													? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
													: query.duration > 500
														? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
														: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}"
											>
												{query.duration}ms
											</span>
										</div>
									</div>
								{/each}
							</div>
						</div>
					</Card>
				{/if}
			{/if}
		</div>
	</div>
</div>

<style>
	:global(.animate-spin) {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
