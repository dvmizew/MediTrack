<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { adminReportsApi } from '$lib/api/client';
	import { authStore } from '$lib/stores/auth';
	import { toast } from '$lib/utils/toast';
	import { downloadBlobAsFile } from '$lib/utils/charts';
	import {
		CheckCircle2,
		ClipboardList,
		Clock,
		HelpCircle,
		Package,
		Pill,
		RefreshCw,
		Syringe,
		Users,
		XCircle,
		Zap
	} from '@lucide/svelte';

	let isAdmin = $derived($authStore.user?.role === 'admin');
	let jobs = $state<any[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let creatingJob = $state(false);
	let refreshInterval: ReturnType<typeof setInterval> | null = null;

	onMount(async () => {
		if (!isAdmin) {
			goto('/dashboard');
			return;
		}
		await loadJobs();
		
		// Auto-refresh every 5 seconds
		refreshInterval = setInterval(loadJobs, 5000);
	});

	onDestroy(() => {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
	});

	async function loadJobs() {
		try {
			loading = true;
			error = null;
			const result = await adminReportsApi.listJobs(undefined, 50);
			jobs = result.jobs || [];
		} catch (e: any) {
			error = e?.message || 'Nu s-au putut încărca job-urile';
			console.error('Failed to load jobs', e);
		} finally {
			loading = false;
		}
	}

	async function createJob(reportType: 'users' | 'treatments' | 'doses' | 'full_system') {
		try {
			creatingJob = true;
			const result = await adminReportsApi.createReportJob(reportType);
			toast.success(`Raport ${reportType} creat! Vei primi notificare când e gata.`);
			await loadJobs();
		} catch (e: any) {
			toast.error(e?.message || 'Nu s-a putut crea job-ul');
		} finally {
			creatingJob = false;
		}
	}

	async function downloadJob(jobId: number) {
		try {
			const blob = await adminReportsApi.downloadReport(jobId);
			const job = jobs.find(j => j.job_id === jobId);
			const filename = job ? `${job.report_type}_report_${jobId}.csv` : `report_${jobId}.csv`;
			downloadBlobAsFile(blob, filename);
			toast.success('Raport descărcat cu succes');
		} catch (e: any) {
			toast.error(e?.message || 'Nu s-a putut descărca raportul');
		}
	}

	async function deleteJob(jobId: number) {
		if (!confirm('Sigur vrei să ștergi acest job?')) return;
		
		try {
			await adminReportsApi.deleteJob(jobId);
			toast.success('Job șters cu succes');
			await loadJobs();
		} catch (e: any) {
			toast.error(e?.message || 'Nu s-a putut șterge job-ul');
		}
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'completed': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
			case 'processing': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
			case 'pending': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
			case 'failed': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
				default: return 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-slate-100';
		}
	}

	function getStatusIconComponent(status: string) {
		switch (status) {
			case 'completed': return CheckCircle2;
			case 'processing': return Clock;
			case 'pending': return Clock;
			case 'failed': return XCircle;
			default: return HelpCircle;
		}
	}

	function formatBytes(bytes: number): string {
		if (!bytes) return 'N/A';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}

	function formatDate(dateString: string): string {
		if (!dateString) return 'N/A';
		const date = new Date(dateString);
		return date.toLocaleString('ro-RO', { 
			dateStyle: 'short', 
			timeStyle: 'short' 
		});
	}
</script>

<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
				<Zap class="w-6 h-6 text-gray-900 dark:text-slate-100" />
				Job-uri Rapoarte
			</h1>
			<p class="text-sm sm:text-base text-gray-600 dark:text-slate-400 mt-1">
				Monitorizare și gestionare rapoarte asincrone, export date și statistici sistem
			</p>
		</div>
		<button
			onclick={loadJobs}
			class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm flex items-center gap-2"
		>
			<RefreshCw class="w-4 h-4" />
			<span>Reîmprospătează</span>
		</button>
	</div>

	<!-- Create New Job Section -->
	<div class="bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-xl p-6">
		<h2 class="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Creează Raport Nou</h2>
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
			<button
				onclick={() => createJob('users')}
				disabled={creatingJob}
				class="p-4 border-2 border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition disabled:opacity-50"
			>
				<Users class="w-8 h-8 mb-2 text-blue-600 dark:text-blue-300" />
				<div class="font-semibold text-gray-900 dark:text-slate-100">Utilizatori</div>
				<div class="text-xs text-gray-600 dark:text-slate-400 mt-1">Export complet utilizatori</div>
			</button>

			<button
				onclick={() => createJob('treatments')}
				disabled={creatingJob}
				class="p-4 border-2 border-green-200 dark:border-green-800 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition disabled:opacity-50"
			>
				<Pill class="w-8 h-8 mb-2 text-green-600 dark:text-green-300" />
				<div class="font-semibold text-gray-900 dark:text-slate-100">Tratamente</div>
				<div class="text-xs text-gray-600 dark:text-slate-400 mt-1">Export toate tratamentele</div>
			</button>

			<button
				onclick={() => createJob('doses')}
				disabled={creatingJob}
				class="p-4 border-2 border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition disabled:opacity-50"
			>
				<Syringe class="w-8 h-8 mb-2 text-purple-600 dark:text-purple-300" />
				<div class="font-semibold text-gray-900 dark:text-slate-100">Doze</div>
				<div class="text-xs text-gray-600 dark:text-slate-400 mt-1">Export istoric doze</div>
			</button>

			<button
				onclick={() => createJob('full_system')}
				disabled={creatingJob}
				class="p-4 border-2 border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition disabled:opacity-50"
			>
				<Package class="w-8 h-8 mb-2 text-orange-600 dark:text-orange-300" />
				<div class="font-semibold text-gray-900 dark:text-slate-100">Sistem Complet</div>
				<div class="text-xs text-gray-600 dark:text-slate-400 mt-1">Export toate datele</div>
			</button>
		</div>
	</div>

	<!-- Jobs List -->
	{#if loading && jobs.length === 0}
		<div class="flex justify-center py-16">
			<div class="animate-spin rounded-full h-12 w-12 border-3 border-blue-600 border-t-transparent"></div>
		</div>
	{:else if error && jobs.length === 0}
		<div class="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-6">
			<p class="text-red-800 dark:text-red-400">{error}</p>
		</div>
	{:else if jobs.length === 0}
		<div class="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-12 text-center">
			<ClipboardList class="w-12 h-12 mx-auto mb-4 text-gray-500 dark:text-slate-400" />
			<h3 class="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">Niciun job încă</h3>
			<p class="text-gray-600 dark:text-slate-400">Creează primul tău raport asincrondeasupra</p>
		</div>
	{:else}
		<div class="bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-xl overflow-hidden">
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
					<thead class="bg-slate-50/80 dark:bg-slate-900/50">
						<tr>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Tip Raport</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Creat</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Finalizat</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Mărime</th>
							<th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Acțiuni</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
						{#each jobs as job}
						{@const StatusIcon = getStatusIconComponent(job.status)}
						<tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
						<td class="px-4 py-3">
							<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium {getStatusColor(job.status)}">
								<StatusIcon class="w-3.5 h-3.5" />
										<span class="capitalize">{job.status}</span>
									</span>
								</td>
								<td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100 capitalize">
									{job.report_type}
								</td>
								<td class="px-4 py-3 text-sm text-gray-600 dark:text-slate-400">
									{formatDate(job.created_at)}
								</td>
								<td class="px-4 py-3 text-sm text-gray-600 dark:text-slate-400">
									{job.completed_at ? formatDate(job.completed_at) : '-'}
								</td>
								<td class="px-4 py-3 text-sm text-gray-600 dark:text-slate-400">
									{formatBytes(job.file_size)}
								</td>
								<td class="px-4 py-3 text-right">
									<div class="flex items-center justify-end gap-2">
										{#if job.status === 'completed'}
											<button
												onclick={() => downloadJob(job.job_id)}
												class="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition"
											>
												Download
											</button>
										{/if}
										{#if job.status === 'failed'}
											<span class="text-xs text-red-600 dark:text-red-400" title={job.error_message}>
												Eșuat
											</span>
										{/if}
										<button
											onclick={() => deleteJob(job.job_id)}
											class="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition"
										>
											Șterge
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Info Footer -->
		<div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
			<div class="flex items-start gap-3">
				<HelpCircle class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
				<div class="text-sm text-gray-700 dark:text-slate-300">
					<p class="font-semibold mb-1">Informații importante:</p>
					<ul class="list-disc list-inside space-y-1 text-xs">
						<li>Rapoartele sunt generate în background și nu blochează interfața</li>
						<li>Vei primi o notificare când raportul este gata</li>
						<li>Rapoartele expiră automat după 24 ore</li>
						<li>Pagina se reîmprospătează automat la fiecare 5 secunde</li>
					</ul>
				</div>
			</div>
		</div>
	{/if}
</main>
