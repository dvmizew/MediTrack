<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { adminReportsApi, api } from '$lib/api/client';
	import { authStore } from '$lib/stores/auth';
	import { toast } from '$lib/utils/toast';
	import { downloadBlobAsFile } from '$lib/utils/charts';
	import { createPieChart, createBarChart, createLineChart } from '$lib/utils/charts';

	let overview = $state<any | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let exporting = $state<string | null>(null);
	let isAdmin = $derived($authStore.user?.role === 'admin');

	let usersPieChart: any = null;
	let treatmentsBarChart: any = null;
	let adherenceLineChart: any = null;

	onMount(async () => {
		if (!isAdmin) {
			goto('/dashboard');
			return;
		}
		try {
			loading = true;
			overview = await adminReportsApi.getOverview();
			
			// Initialize charts after data loads
			setTimeout(initCharts, 100);
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
				if (usersPieChart) usersPieChart.destroy();
				const userData = overview.users.byRole.map((r: any) => ({
					label: r.role.charAt(0).toUpperCase() + r.role.slice(1),
					value: r.count
				}));
				usersPieChart = createPieChart(usersCtx.getContext('2d')!, userData, 'Utilizatori după Rol');
			}

			// Treatments bar chart
			const treatmentsCtx = document.getElementById('treatmentsBarChart') as HTMLCanvasElement;
			if (treatmentsCtx) {
				if (treatmentsBarChart) treatmentsBarChart.destroy();
				treatmentsBarChart = createBarChart(
					treatmentsCtx.getContext('2d')!,
					['Activ', 'Inactiv'],
					[{
						label: 'Planuri de Tratament',
						data: [overview.treatments.active, overview.treatments.inactive]
					}],
					'Starea Planurilor de Tratament'
				);
			}

			// Adherence line chart (simulated data for now)
			const adherenceCtx = document.getElementById('adherenceLineChart') as HTMLCanvasElement;
			if (adherenceCtx) {
				if (adherenceLineChart) adherenceLineChart.destroy();
				adherenceLineChart = createLineChart(
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

	async function handleExport(type: 'users' | 'treatments' | 'collaborations') {
		try {
			exporting = type;
			let blob: Blob;
			let filename: string;

			if (type === 'users') {
				blob = await adminReportsApi.exportUsers();
				filename = `users_${new Date().toISOString().split('T')[0]}.csv`;
			} else if (type === 'treatments') {
				blob = await adminReportsApi.exportTreatments();
				filename = `treatments_${new Date().toISOString().split('T')[0]}.csv`;
			} else {
				blob = await adminReportsApi.exportCollaborations();
				filename = `collaborations_${new Date().toISOString().split('T')[0]}.csv`;
			}

			await downloadBlobAsFile(blob, filename);
			toast.success(`Raport ${type} exportat cu succes`);
		} catch (err: any) {
			console.error('Export error:', err);
			toast.error(`Eroare la export ${type}`);
		} finally {
			exporting = null;
		}
	}

	function formatPercent(value: number) {
		return `${Math.round((value || 0) * 100)}%`;
	}
</script>

<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
	<div class="flex items-center justify-between">
		<div class="space-y-1">
			<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">📊 Rapoarte Admin</h1>
			<p class="text-gray-600 dark:text-gray-400">Overview utilizatori, colaborări și aderență cu grafice și export.</p>
		</div>
		
		<div class="flex gap-2 flex-wrap justify-end">
			<button
				onclick={() => handleExport('users')}
				disabled={exporting !== null}
				class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm"
			>
				{exporting === 'users' ? '⏳ Exporta...' : '💾 Export Utilizatori'}
			</button>
			<button
				onclick={() => handleExport('treatments')}
				disabled={exporting !== null}
				class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm"
			>
				{exporting === 'treatments' ? '⏳ Exporta...' : '💾 Export Tratamente'}
			</button>
			<button
				onclick={() => handleExport('collaborations')}
				disabled={exporting !== null}
				class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm"
			>
				{exporting === 'collaborations' ? '⏳ Exporta...' : '💾 Export Colaborări'}
			</button>
		</div>
	</div>

	{#if loading}
		<div class="flex justify-center items-center py-16">
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
		</div>
	{:else if error}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg">
			{error}
		</div>
	{:else if overview}
		<!-- Charts Row -->
		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">👥 Utilizatori după Rol</h2>
				<canvas id="usersPieChart"></canvas>
			</div>

			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">📋 Planuri Tratament</h2>
				<canvas id="treatmentsBarChart"></canvas>
			</div>

			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">📈 Aderență</h2>
				<canvas id="adherenceLineChart"></canvas>
			</div>
		</div>

		<!-- Stats Cards -->
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-md">
				<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">👤 Total Utilizatori</h3>
				<p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{overview.users.active + overview.users.inactive}</p>
				<p class="text-xs text-green-600 dark:text-green-400 mt-2">🟢 Activi: {overview.users.active}</p>
			</div>

			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-md">
				<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">📋 Planuri Tratament</h3>
				<p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{overview.treatments.total}</p>
				<p class="text-xs text-blue-600 dark:text-blue-400 mt-2">🟢 Active: {overview.treatments.active}</p>
			</div>

			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-md">
				<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">💊 Doze Programate</h3>
				<p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{overview.doses.total}</p>
				<p class="text-xs text-gray-500 dark:text-gray-400 mt-2">Total în sistem</p>
			</div>

			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-md">
				<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">✅ Aderență 30 zile</h3>
				<p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatPercent(overview.adherence.last30Days.rate)}</p>
				<p class="text-xs text-gray-500 dark:text-gray-400 mt-2">{overview.adherence.last30Days.confirmed} / {overview.adherence.last30Days.scheduled}</p>
			</div>
		</div>

		<!-- Detailed Tables -->
		<div class="grid gap-6 md:grid-cols-2">
			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">👥 Utilizatori după Rol</h2>
				<div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
					<table class="min-w-full text-sm">
						<thead class="bg-gray-50 dark:bg-gray-900/40 text-gray-600 dark:text-gray-300 uppercase tracking-wide text-xs">
							<tr>
								<th class="px-4 py-3 text-left">Rol</th>
								<th class="px-4 py-3 text-right">Număr</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 dark:divide-gray-700 text-gray-800 dark:text-gray-200">
							{#each overview.users.byRole as row}
								<tr class="hover:bg-gray-50 dark:hover:bg-gray-700/30">
									<td class="px-4 py-3 capitalize font-medium">{row.role}</td>
									<td class="px-4 py-3 text-right font-semibold">{row.count}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">🤝 Colaborări după Status</h2>
				<div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
					<table class="min-w-full text-sm">
						<thead class="bg-gray-50 dark:bg-gray-900/40 text-gray-600 dark:text-gray-300 uppercase tracking-wide text-xs">
							<tr>
								<th class="px-4 py-3 text-left">Status</th>
								<th class="px-4 py-3 text-right">Număr</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 dark:divide-gray-700 text-gray-800 dark:text-gray-200">
							{#each overview.collaborations as row}
								<tr class="hover:bg-gray-50 dark:hover:bg-gray-700/30">
									<td class="px-4 py-3 capitalize font-medium">{row.status}</td>
									<td class="px-4 py-3 text-right font-semibold">{row.count}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>

		<!-- Adherence Details -->
		<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">📊 Detalii Aderență</h2>
			<div class="grid gap-4 md:grid-cols-2">
				<div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
					<p class="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">📅 Ultima 7 zile</p>
					<p class="text-2xl font-bold text-blue-900 dark:text-blue-100">{formatPercent(overview.adherence.last7Days.rate)}</p>
					<p class="text-xs text-blue-700 dark:text-blue-300 mt-2">
						{overview.adherence.last7Days.confirmed} confirmate din {overview.adherence.last7Days.scheduled} programate
					</p>
				</div>
				<div class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
					<p class="text-sm font-semibold text-green-900 dark:text-green-300 mb-2">📆 Ultima 30 zile</p>
					<p class="text-2xl font-bold text-green-900 dark:text-green-100">{formatPercent(overview.adherence.last30Days.rate)}</p>
					<p class="text-xs text-green-700 dark:text-green-300 mt-2">
						{overview.adherence.last30Days.confirmed} confirmate din {overview.adherence.last30Days.scheduled} programate
					</p>
				</div>
			</div>
		</div>
	{/if}
</main>
