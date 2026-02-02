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
		Zap,
		Shield,
		Eye,
		X
	} from '@lucide/svelte';

	let isAdmin = $derived($authStore.user?.role === 'admin');
	let jobs = $state<any[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let creatingJob = $state(false);
	let refreshInterval: ReturnType<typeof setInterval> | null = null;
	let showAnonModal = $state(false);
	let selectedAnonType = $state<'users' | 'treatments' | 'doses' | 'full_system' | null>(null);

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

	async function createJob(reportType: 'users' | 'treatments' | 'doses' | 'full_system', isAnonymous: boolean = false) {
		try {
			creatingJob = true;
			const result = await adminReportsApi.createReportJob(reportType, isAnonymous);
			const label = isAnonymous ? `${reportType} (anonimizat)` : reportType;
			toast.success(`Raport ${label} creat! Vei primi notificare când e gata.`);
			showAnonModal = false;
			selectedAnonType = null;
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

	function closeAnonModal() {
		showAnonModal = false;
		selectedAnonType = null;
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
				aria-label="Creează raport utilizatori"
			>
				<Users class="w-8 h-8 mb-2 text-blue-600 dark:text-blue-300" />
				<div class="font-semibold text-gray-900 dark:text-slate-100">Utilizatori</div>
				<div class="text-xs text-gray-600 dark:text-slate-400 mt-1">Export complet utilizatori</div>
			</button>

			<button
				onclick={() => createJob('treatments')}
				disabled={creatingJob}
				class="p-4 border-2 border-green-200 dark:border-green-800 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition disabled:opacity-50"
				aria-label="Creează raport tratamente"
			>
				<Pill class="w-8 h-8 mb-2 text-green-600 dark:text-green-300" />
				<div class="font-semibold text-gray-900 dark:text-slate-100">Tratamente</div>
				<div class="text-xs text-gray-600 dark:text-slate-400 mt-1">Export toate tratamentele</div>
			</button>

			<button
				onclick={() => createJob('doses')}
				disabled={creatingJob}
				class="p-4 border-2 border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition disabled:opacity-50"
				aria-label="Creează raport doze"
			>
				<Syringe class="w-8 h-8 mb-2 text-purple-600 dark:text-purple-300" />
				<div class="font-semibold text-gray-900 dark:text-slate-100">Doze</div>
				<div class="text-xs text-gray-600 dark:text-slate-400 mt-1">Export istoric doze</div>
			</button>

			<button
				onclick={() => createJob('full_system')}
				disabled={creatingJob}
				class="p-4 border-2 border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition disabled:opacity-50"
				aria-label="Creează raport sistem complet"
			>
				<Package class="w-8 h-8 mb-2 text-orange-600 dark:text-orange-300" />
				<div class="font-semibold text-gray-900 dark:text-slate-100">Sistem Complet</div>
				<div class="text-xs text-gray-600 dark:text-slate-400 mt-1">Export toate datele</div>
			</button>
		</div>

		<!-- Anonymous Export Section -->
		<div class="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
			<div class="flex items-start gap-3 mb-4">
				<Shield class="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
				<div>
					<h3 class="font-semibold text-gray-900 dark:text-slate-100">Export Anonimizat</h3>
					<p class="text-xs sm:text-sm text-gray-600 dark:text-slate-400 mt-0.5">
						Exportă date cu informații personale anonimizate pentru distribuire sigură
					</p>
				</div>
			</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
				<button
					onclick={() => {
						selectedAnonType = 'users';
						showAnonModal = true;
					}}
					disabled={creatingJob}
					class="p-4 border-2 border-green-200 dark:border-green-800 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition disabled:opacity-50"
					aria-label="Creează raport anonimizat utilizatori"
				>
					<Users class="w-8 h-8 mb-2 text-green-600 dark:text-green-300" />
					<div class="font-semibold text-gray-900 dark:text-slate-100 text-sm">Utilizatori (Anon.)</div>
					<div class="text-xs text-gray-600 dark:text-slate-400 mt-1">Fără email/nume</div>
				</button>

				<button
					onclick={() => {
						selectedAnonType = 'treatments';
						showAnonModal = true;
					}}
					disabled={creatingJob}
					class="p-4 border-2 border-green-200 dark:border-green-800 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition disabled:opacity-50"
					aria-label="Creează raport anonimizat tratamente"
				>
					<Pill class="w-8 h-8 mb-2 text-green-600 dark:text-green-300" />
					<div class="font-semibold text-gray-900 dark:text-slate-100 text-sm">Tratamente (Anon.)</div>
					<div class="text-xs text-gray-600 dark:text-slate-400 mt-1">Fără pacient/medic</div>
				</button>

				<button
					onclick={() => {
						selectedAnonType = 'doses';
						showAnonModal = true;
					}}
					disabled={creatingJob}
					class="p-4 border-2 border-green-200 dark:border-green-800 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition disabled:opacity-50"
					aria-label="Creează raport anonimizat doze"
				>
					<Syringe class="w-8 h-8 mb-2 text-green-600 dark:text-green-300" />
					<div class="font-semibold text-gray-900 dark:text-slate-100 text-sm">Doze (Anon.)</div>
					<div class="text-xs text-gray-600 dark:text-slate-400 mt-1">Fără informații pacient</div>
				</button>

				<button
					onclick={() => {
						selectedAnonType = 'full_system';
						showAnonModal = true;
					}}
					disabled={creatingJob}
					class="p-4 border-2 border-green-200 dark:border-green-800 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition disabled:opacity-50"
					aria-label="Creează raport anonimizat sistem complet"
				>
					<Package class="w-8 h-8 mb-2 text-green-600 dark:text-green-300" />
					<div class="font-semibold text-gray-900 dark:text-slate-100 text-sm">Sistem (Anon.)</div>
					<div class="text-xs text-gray-600 dark:text-slate-400 mt-1">Toate datele anonimizate</div>
				</button>
			</div>
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
			<p class="text-gray-600 dark:text-slate-400">Creează primul tău raport asincron deasupra</p>
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

	<!-- Anonymous Export Confirmation Modal -->
	{#if showAnonModal && selectedAnonType}
		<div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
			<div class="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full p-6" role="dialog" aria-modal="true" aria-labelledby="anon-modal-title">
				<div class="flex items-start justify-between mb-4">
					<div class="flex items-start gap-3">
						<Shield class="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
						<div>
							<h3 id="anon-modal-title" class="font-semibold text-gray-900 dark:text-slate-100">Export Anonimizat</h3>
							<p class="text-sm text-gray-600 dark:text-slate-400 mt-1">
								Confirmă crearea raportului cu date anonimizate
							</p>
						</div>
					</div>
					<button
						onclick={closeAnonModal}
						class="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
						aria-label="Închide modal"
					>
						<X class="w-5 h-5" />
					</button>
				</div>

				<div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
					<div class="flex gap-3">
						<Eye class="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
						<div class="text-sm text-green-800 dark:text-green-200">
							<p class="font-semibold mb-2">Datele vor fi anonimizate:</p>
							<ul class="space-y-1 text-xs">
								{#if selectedAnonType === 'users' || selectedAnonType === 'full_system'}
									<li>• Email-uri înlocuite cu ID-uri anonime</li>
									<li>• Nume înlocuite cu "Utilizator #ID"</li>
								{/if}
								{#if selectedAnonType === 'treatments' || selectedAnonType === 'full_system'}
									<li>• Pacienți și medici identificați prin ID</li>
									<li>• Diagnostic păstrat (informație clinică)</li>
								{/if}
								{#if selectedAnonType === 'doses' || selectedAnonType === 'full_system'}
									<li>• Utilizator identificat prin ID</li>
									<li>• Date de administrare păstrate (statistic)</li>
								{/if}
							</ul>
						</div>
					</div>
				</div>

				<p class="text-xs text-gray-600 dark:text-slate-400 mb-6">
					Raportul va fi generat în background. Vei putea descărca fișierul după finalizare.
				</p>

				<div class="flex gap-3">
					<button
						onclick={closeAnonModal}
						class="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-slate-100 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition"
					>
						Anulează
					</button>
					<button
						onclick={() => selectedAnonType && createJob(selectedAnonType, true)}
						disabled={creatingJob}
						class="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-medium"
					>
						{creatingJob ? 'Se procesează...' : 'Confirmă'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</main>
