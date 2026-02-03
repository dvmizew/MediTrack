<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { adminReportsApi } from '$lib/api/client';
	import { authStore } from '$lib/stores/auth';
	import Card from '$lib/components/Card.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import { Activity, AlertCircle, Zap, Users, TrendingUp, RotateCcw } from '@lucide/svelte';

	let overview = $state<any | null>(null);
	let metrics = $state<any | null>(null);
	let queryPerformance = $state<any | null>(null);
	let loading = $state(true);
	let refreshing = $state(false);
	let error = $state<string | null>(null);
	let isAdmin = $derived($authStore.user?.role === 'admin');

	async function loadData() {
		try {
			refreshing = true;
			const [overviewData, metricsData, queryData] = await Promise.all([
				adminReportsApi.getOverview().catch(() => null),
				adminReportsApi.getMetrics().catch(() => null),
				adminReportsApi.getQueryPerformance().catch(() => null)
			]);

			overview = overviewData;
			metrics = metricsData;
			queryPerformance = queryData;
			error = null;
		} catch (e: any) {
			error = e?.message || 'Nu s-au putut încărca datele de monitorizare.';
		} finally {
			refreshing = false;
			loading = false;
		}
	}

	async function clearMetrics() {
		try {
			await adminReportsApi.clearQueryMetrics();
			loadData();
		} catch (e: any) {
			error = e?.message || 'Nu s-au putut șterge metricile.';
		}
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

	function getSlowQueryCount(): number {
		if (!queryPerformance?.recentQueries) return 0;
		return queryPerformance.recentQueries.filter((q: any) => q.duration > 1000).length;
	}

	function getSlowEndpointCount(): number {
		if (!metrics?.summary) return 0;
		return Object.values(metrics.summary).filter((s: any) => s.avgDuration > 500).length;
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
	<div class="max-w-7xl mx-auto">
		<!-- Header -->
		<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
			<div>
				<h1 class="text-4xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
					<Activity class="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
					Monitorizare Sistem
				</h1>
				<p class="text-slate-600 dark:text-slate-400 mt-1">
					Real-time metrics și performanță
				</p>
			</div>
			<button
				onclick={loadData}
				disabled={refreshing}
				class="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				<div class:animate-spin={refreshing}>
					<RotateCcw class="w-4 h-4" />
				</div>
				{refreshing ? 'Se reîncarcă...' : 'Reîncarcă'}
			</button>
		</div>

		<!-- Error Alert -->
		{#if error}
			<Alert type="error" containerClass="mb-6">
				{error}
			</Alert>
		{/if}

		{#if loading}
			<div class="flex items-center justify-center py-12">
				<div class="text-center">
					<div class="inline-block animate-spin mb-4">
						<div class="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full"></div>
					</div>
					<p class="text-slate-600 dark:text-slate-400">Se încarcă datele de monitorizare...</p>
				</div>
			</div>
		{:else}
			<!-- Key Metrics -->
			<div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
				<!-- Active Users -->
				<Card renderCustom containerClass="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm">
					<div class="flex items-start justify-between">
						<div>
							<p class="text-sm font-medium text-slate-600 dark:text-slate-400">Utilizatori Activi</p>
							<p class="text-3xl font-bold text-slate-900 dark:text-white mt-2">
								{overview?.activeUsers?.today || 0}
							</p>
							<p class="text-xs text-slate-500 dark:text-slate-500 mt-1">
								{overview?.users?.total || 0} total
							</p>
						</div>
						<Users class="w-8 h-8 text-blue-500 opacity-50" />
					</div>
				</Card>

				<!-- Total Requests -->
				<Card renderCustom containerClass="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm">
					<div class="flex items-start justify-between">
						<div>
							<p class="text-sm font-medium text-slate-600 dark:text-slate-400">Total Cereri</p>
							<p class="text-3xl font-bold text-slate-900 dark:text-white mt-2">
								{metrics?.totalRequests || 0}
							</p>
							<p class="text-xs text-slate-500 dark:text-slate-500 mt-1">
								Ultimele 50 afișate
							</p>
						</div>
						<TrendingUp class="w-8 h-8 text-green-500 opacity-50" />
					</div>
				</Card>

				<!-- Slow Queries -->
				<Card renderCustom containerClass="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm">
					<div class="flex items-start justify-between">
						<div>
							<p class="text-sm font-medium text-slate-600 dark:text-slate-400">Queries Lente (&gt;1s)</p>
							<p class="text-3xl font-bold text-slate-900 dark:text-white mt-2">
								{getSlowQueryCount()}
							</p>
							<p class="text-xs text-slate-500 dark:text-slate-500 mt-1">
								{queryPerformance?.recentQueries?.length || 0} queries recent
							</p>
						</div>
						<Zap class="w-8 h-8 text-yellow-500 opacity-50" />
					</div>
				</Card>

				<!-- Slow Endpoints -->
				<Card renderCustom containerClass="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm">
					<div class="flex items-start justify-between">
						<div>
							<p class="text-sm font-medium text-slate-600 dark:text-slate-400">Endpoint-uri Lente (&gt;500ms)</p>
							<p class="text-3xl font-bold text-slate-900 dark:text-white mt-2">
								{getSlowEndpointCount()}
							</p>
							<p class="text-xs text-slate-500 dark:text-slate-500 mt-1">
								{Object.keys(metrics?.summary || {}).length} endpoint-uri total
							</p>
						</div>
						<AlertCircle class="w-8 h-8 text-red-500 opacity-50" />
					</div>
				</Card>
			</div>

			<!-- User Activity -->
			{#if overview?.activeUsers}
			<Card renderCustom containerClass="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm mb-8">
					<h2 class="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
						<Users class="w-5 h-5 text-blue-600" />
						Activitate Utilizatori
					</h2>
					<div class="grid grid-cols-2 md:grid-cols-5 gap-4">
						<div class="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
							<p class="text-xs text-slate-600 dark:text-slate-400 font-medium">Astăzi</p>
							<p class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{overview.activeUsers.today}</p>
						</div>
						<div class="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
							<p class="text-xs text-slate-600 dark:text-slate-400 font-medium">Săptămâna</p>
							<p class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{overview.activeUsers.week}</p>
						</div>
						<div class="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
							<p class="text-xs text-slate-600 dark:text-slate-400 font-medium">Luna</p>
							<p class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{overview.activeUsers.month}</p>
						</div>
						<div class="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
							<p class="text-xs text-slate-600 dark:text-slate-400 font-medium">Total Utilizatori</p>
							<p class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{overview.users.total}</p>
						</div>
						<div class="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
							<p class="text-xs text-slate-600 dark:text-slate-400 font-medium">Rate Activ</p>
							<p class="text-2xl font-bold text-slate-900 dark:text-white mt-1">
								{overview.users.total ? Math.round((overview.activeUsers.today / overview.users.total) * 100) : 0}%
							</p>
						</div>
					</div>
				</Card>
			{/if}

			<!-- Endpoint Performance -->
			{#if metrics?.summary && Object.keys(metrics.summary).length > 0}
			<Card renderCustom containerClass="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm mb-8">
					<h2 class="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
						<TrendingUp class="w-5 h-5 text-green-600" />
						Performanță Endpoint-uri
					</h2>
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-slate-200 dark:border-slate-700">
									<th class="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Endpoint</th>
									<th class="text-right py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Cereri</th>
									<th class="text-right py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Avg (ms)</th>
									<th class="text-right py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Min (ms)</th>
									<th class="text-right py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Max (ms)</th>
								</tr>
							</thead>
							<tbody>
								{#each Object.entries(metrics.summary)
									.sort(([, a]: any, [, b]: any) => b.avgDuration - a.avgDuration)
									.slice(0, 15) as [endpoint, stats]}
									{@const s = stats as any}
									<tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
										<td class="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
											{endpoint}
										</td>
										<td class="py-3 px-4 text-right text-slate-900 dark:text-white">{s.count}</td>
										<td class="py-3 px-4 text-right">
											<span class="inline-block px-2 py-1 rounded {s.avgDuration > 500 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'} font-semibold">
												{s.avgDuration}
											</span>
										</td>
										<td class="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{s.minDuration}</td>
										<td class="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{s.maxDuration}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</Card>
			{/if}

			<!-- Query Performance -->
			{#if queryPerformance?.recentQueries && queryPerformance.recentQueries.length > 0}
			<Card renderCustom containerClass="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm mb-8">
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
							<Zap class="w-5 h-5 text-yellow-600" />
							Query Performance (Ultimele 10)
						</h2>
						<button
						onclick={clearMetrics}
							class="text-xs px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
						>
							Șterge Metrice
						</button>
					</div>
					<div class="space-y-2 max-h-96 overflow-y-auto">
						{#each queryPerformance.recentQueries as query, i}
							<div class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
								<div class="flex-1 min-w-0">
									<p class="text-xs font-mono text-slate-600 dark:text-slate-400 truncate">
										{query.query.substring(0, 60)}...
									</p>
									<p class="text-xs text-slate-500 dark:text-slate-500 mt-1">
										{new Date(query.timestamp).toLocaleTimeString('ro-RO')}
									</p>
								</div>
								<div class="flex-shrink-0 text-right">
									<span class="inline-block px-2 py-1 rounded font-bold {query.duration > 1000 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : query.duration > 500 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'}">
										{query.duration}ms
									</span>
								</div>
							</div>
						{/each}
					</div>
				</Card>
			{/if}
		{/if}
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
