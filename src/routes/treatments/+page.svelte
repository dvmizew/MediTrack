<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { authStore, isMedic } from '$lib/stores/auth';
	import { api, adminReportsApi } from '$lib/api/client';
	import Modal from '$lib/components/Modal.svelte';
	import { loadCollaborations as loadCollabs } from '$lib/utils/loaders';
	import { treatmentSchema, parseWithFriendlyErrors } from '$lib/validation/schemas';

	let treatments = $state<any[]>([]);
	let adminOverview = $state<any>(null);
	let loading = $state(true);
	let error = $state('');
	let showNewTreatmentModal = $state(false);
	let isSubmitting = $state(false);
	let collaborations = $state<any[]>([]);
	let loadingCollabs = $state(false);

	let isAdmin = $derived($authStore.user?.role === 'admin');

	let formData = $state({
		patientId: '',
		diagnostic: '',
		descriere: ''
	});

	onMount(async () => {
		if (!$authStore.isAuthenticated) {
			goto('/');
			return;
		}
		await loadTreatments();
		
		// Check if we should open the new treatment modal
		const createNew = $page.url.searchParams.get('createNew');
		const pacientId = $page.url.searchParams.get('pacientId');
		if (createNew === 'true' && pacientId) {
			formData.patientId = pacientId;
			showNewTreatmentModal = true;
		}
	});

	async function loadTreatments() {
		try {
			loading = true;
			error = '';
			
			if (isAdmin) {
				// Admin loads global overview
				adminOverview = await adminReportsApi.getOverview();
			} else {
				// Regular users load their treatments
				const data = await api.getTreatments();
				treatments = data;
			}
		} catch (err: any) {
			console.error('Failed to load treatments:', err);
			error = err.message || 'Nu s-au putut încărca tratamentele';
		} finally {
			loading = false;
		}
	}

	function viewDetails(treatmentId: number) {
		goto(`/treatments/${treatmentId}`);
	}

	async function loadCollaborations() {
		try {
			loadingCollabs = true;
			collaborations = await loadCollabs();
		} catch (err) {
			console.error('Failed to load collaborations:', err);
		} finally {
			loadingCollabs = false;
		}
	}

	function openNewTreatmentModal() {
		formData.patientId = '';
		formData.diagnostic = '';
		formData.descriere = '';
		if (collaborations.length === 0) {
			loadCollaborations();
		}
		showNewTreatmentModal = true;
	}

	function closeNewTreatmentModal() {
		showNewTreatmentModal = false;
	}

	async function handleCreateTreatment() {
		if (!formData.patientId || !formData.diagnostic.trim()) {
			return;
		}

		try {
			isSubmitting = true;
			const parsed = parseWithFriendlyErrors(treatmentSchema, {
				name: formData.diagnostic,
				description: formData.descriere || undefined,
				dosage: 'N/A'
			});
			if (!parsed.success) {
				return;
			}

			const result = await api.createTreatment({
				pacientId: parseInt(formData.patientId),
				diagnosis: formData.diagnostic,
				description: formData.descriere || undefined
			});

			closeNewTreatmentModal();
			await loadTreatments();
			goto(`/treatments/${result.planId}`);
		} catch (err: any) {
			console.error('Failed to create treatment:', err);
		} finally {
			isSubmitting = false;
		}
	}
</script>

{#if $authStore.isAuthenticated}
	<main class="page-transition max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
		<div class="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
			<div>
				<h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">📋 Planuri de Tratament</h1>
				<p class="text-sm sm:text-base text-gray-800 font-medium">
					{#if isAdmin}
						Overview global al tuturor tratamentelor din sistem
					{:else if $isMedic}
						Gestionează planurile de tratament pentru pacienții tăi
					{:else}
						Vezi și gestionează planurile tale de tratament
					{/if}
				</p>
			</div>
			{#if $isMedic}
				<button
					onclick={openNewTreatmentModal}
					class="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2 whitespace-nowrap flex-shrink-0"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
					</svg>
					Tratament Nou
				</button>
			{/if}
		</div>

		{#if error}
			<div class="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-4 sm:p-6 mb-6 flex items-start gap-3 animate-shake">
				<svg class="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
				</svg>
				<p class="text-sm sm:text-base text-red-800 dark:text-red-400 font-medium">{error}</p>
			</div>
		{/if}

		{#if isAdmin}
			<!-- Admin View: Global Statistics -->
			{#if loading}
				<div class="flex justify-center py-16">
					<div class="animate-spin rounded-full h-12 w-12 border-3 border-blue-600 border-t-transparent shadow-lg shadow-blue-500/50"></div>
				</div>
			{:else if adminOverview}
				<!-- Stats Cards -->
				<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
					<div class="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/30 border border-green-200 dark:border-green-800 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5">
						<div class="flex items-center gap-1.5 sm:gap-2 mb-2">
							<span class="text-base sm:text-lg">✅</span>
							<h3 class="text-xs sm:text-sm font-semibold text-green-900 dark:text-green-300 truncate">Active</h3>
						</div>
						<p class="text-xl sm:text-2xl md:text-3xl font-bold text-green-900 dark:text-green-100 mb-1">
							{adminOverview.treatments.active}
						</p>
						<p class="text-xs text-green-700 dark:text-green-400 truncate">În derulare</p>
					</div>

					<div class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-900/30 border border-gray-200 dark:border-gray-800 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5">
						<div class="flex items-center gap-1.5 sm:gap-2 mb-2">
							<span class="text-base sm:text-lg">⏸️</span>
							<h3 class="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-300 truncate">Inactive</h3>
						</div>
						<p class="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
							{adminOverview.treatments.inactive}
						</p>
						<p class="text-xs text-gray-700 dark:text-gray-400 truncate">Finalizate</p>
					</div>

					<div class="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5">
						<div class="flex items-center gap-1.5 sm:gap-2 mb-2">
							<span class="text-base sm:text-lg">📊</span>
							<h3 class="text-xs sm:text-sm font-semibold text-blue-900 dark:text-blue-300 truncate">Total</h3>
						</div>
						<p class="text-xl sm:text-2xl md:text-3xl font-bold text-blue-900 dark:text-blue-100 mb-1">
							{adminOverview.treatments.total}
						</p>
						<p class="text-xs text-blue-700 dark:text-blue-400 truncate">În sistem</p>
					</div>
				</div>

				<!-- Detailed Breakdown -->
				<div class="grid gap-4 sm:gap-6 md:grid-cols-2">
					<!-- Status Breakdown -->
					<div class="bg-white/90 dark:bg-gray-900/70 border border-slate-200/70 dark:border-gray-800/70 rounded-xl shadow-sm overflow-hidden">
						<div class="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
							<h2 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">📊 Detalii Status</h2>
							<p class="text-xs text-gray-700 dark:text-gray-300 mt-1">Distribuție pe statusuri</p>
						</div>
						<div class="p-4 sm:p-6 space-y-4">
							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<span class="text-lg sm:text-xl">✅</span>
										<span class="text-sm sm:text-base font-medium text-green-900 dark:text-green-100">Active</span>
									</div>
									<span class="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">{adminOverview.treatments.active}</span>
								</div>
								<!-- Progress bar -->
								<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 sm:h-2.5 overflow-hidden">
									<div 
										class="bg-gradient-to-r from-green-500 to-green-600 h-full transition-all duration-500 rounded-full"
										style="width: {adminOverview.treatments.total > 0 ? (adminOverview.treatments.active / adminOverview.treatments.total) * 100 : 0}%"
									></div>
								</div>
								<div class="text-xs text-gray-700 dark:text-gray-300">
									{adminOverview.treatments.total > 0 ? Math.round((adminOverview.treatments.active / adminOverview.treatments.total) * 100) : 0}% din total
								</div>
							</div>

							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<span class="text-lg sm:text-xl">⏸️</span>
										<span class="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100">Inactive</span>
									</div>
									<span class="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">{adminOverview.treatments.inactive}</span>
								</div>
								<!-- Progress bar -->
								<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 sm:h-2.5 overflow-hidden">
									<div 
										class="bg-gradient-to-r from-gray-500 to-gray-600 h-full transition-all duration-500 rounded-full"
										style="width: {adminOverview.treatments.total > 0 ? (adminOverview.treatments.inactive / adminOverview.treatments.total) * 100 : 0}%"
									></div>
								</div>
								<div class="text-xs text-gray-700 dark:text-gray-300">
									{adminOverview.treatments.total > 0 ? Math.round((adminOverview.treatments.inactive / adminOverview.treatments.total) * 100) : 0}% din total
								</div>
							</div>
							
							<!-- Summary -->
							<div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
								<div class="flex justify-between text-sm">
									<span class="text-gray-700 dark:text-gray-300">Total tratamente:</span>
									<span class="font-bold text-gray-900 dark:text-gray-100">
										{adminOverview.treatments.total}
									</span>
								</div>
								<div class="flex justify-between text-sm">
									<span class="text-gray-700 dark:text-gray-300">Rata activare:</span>
									<span class="font-bold {adminOverview.treatments.total > 0 && (adminOverview.treatments.active / adminOverview.treatments.total) > 0.7 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}">
										{adminOverview.treatments.total > 0 ? Math.round((adminOverview.treatments.active / adminOverview.treatments.total) * 100) : 0}%
									</span>
								</div>
							</div>
						</div>
					</div>

					<!-- Quick Actions -->
					<div class="bg-white/90 dark:bg-gray-900/70 border border-slate-200/70 dark:border-gray-800/70 rounded-xl shadow-sm overflow-hidden">
						<div class="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
							<h2 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">⚡ Acțiuni Rapide</h2>
							<p class="text-xs text-gray-700 dark:text-gray-300 mt-1">Administrare sistem</p>
						</div>
						<div class="p-4 sm:p-6 space-y-3">
							<a
								href="/admin/users"
								class="block p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200"
							>
								<div class="flex items-center gap-3">
									<div class="text-2xl sm:text-3xl">👥</div>
									<div class="flex-1 min-w-0">
										<h3 class="text-sm sm:text-base font-semibold text-blue-900 dark:text-blue-100 truncate">Gestionează Utilizatori</h3>
										<p class="text-xs text-blue-700 dark:text-blue-300 truncate">Vezi toți utilizatorii</p>
									</div>
									<svg class="w-5 h-5 text-blue-400 dark:text-blue-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
									</svg>
								</div>
							</a>

							<a
								href="/admin/reports"
								class="block p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/30 border border-green-200 dark:border-green-800 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200"
							>
								<div class="flex items-center gap-3">
									<div class="text-2xl sm:text-3xl">📊</div>
									<div class="flex-1 min-w-0">
										<h3 class="text-sm sm:text-base font-semibold text-green-900 dark:text-green-100 truncate">Rapoarte Detaliate</h3>
										<p class="text-xs text-green-700 dark:text-green-300 truncate">Export și analize</p>
									</div>
									<svg class="w-5 h-5 text-green-400 dark:text-green-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
									</svg>
								</div>
							</a>

							<a
								href="/dashboard"
								class="block p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200"
							>
								<div class="flex items-center gap-3">
									<div class="text-2xl sm:text-3xl">📈</div>
									<div class="flex-1 min-w-0">
										<h3 class="text-sm sm:text-base font-semibold text-purple-900 dark:text-purple-100 truncate">Dashboard Admin</h3>
										<p class="text-xs text-purple-700 dark:text-purple-300 truncate">Overview complet</p>
									</div>
									<svg class="w-5 h-5 text-purple-400 dark:text-purple-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
									</svg>
								</div>
							</a>
						</div>
					</div>
				</div>
			{/if}
		{:else}
			<!-- Regular User View -->
			{#if loading}
				<div class="flex justify-center py-20">
					<div class="animate-spin rounded-full h-14 w-14 border-4 border-blue-600 border-t-transparent"></div>
				</div>
			{:else if error}
				<div class="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-6 flex items-start gap-3 animate-shake">
					<svg class="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
					</svg>
					<p class="text-red-800 dark:text-red-400 font-medium">{error}</p>
				</div>
			{:else if treatments.length === 0}
			<div class="bg-white/90 dark:bg-gray-900/70 border border-slate-200/70 dark:border-gray-800/70 rounded-2xl shadow-sm p-16 text-center animate-scale-in">
				<div class="max-w-sm mx-auto">
					<svg
						class="mx-auto h-20 w-20 text-gray-300 dark:text-gray-600 mb-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
						/>
					</svg>
					<h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Niciun tratament încă</h3>
					<p class="text-gray-700 dark:text-gray-300">
						{#if $isMedic}
							Începe prin a crea un plan de tratament pentru unul dintre pacienții tăi
						{:else}
							Medicul tău va crea planuri de tratament aici
						{/if}
					</p>
				</div>
			</div>
		{:else}
			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each treatments as treatment}
				<button
					type="button"
					class="bg-white/90 dark:bg-gray-900/70 border border-slate-200/70 dark:border-gray-800/70 rounded-xl shadow-sm p-6 hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-600 transition cursor-pointer group text-left w-full"
					onclick={() => viewDetails(treatment.planId)}
					aria-label="Vezi detalii pentru {treatment.diagnosis}"
				>
					<div class="flex justify-between items-start mb-4">
						<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
							{treatment.diagnosis}
						</h3>
						<span
							class="px-3 py-1 text-xs font-semibold rounded-full shadow-sm"
							class:bg-green-500={treatment.isActive}
							class:text-white={treatment.isActive}
							class:bg-gray-100={!treatment.isActive}
							class:text-gray-600={!treatment.isActive}
						>
							{treatment.isActive ? '✓ Activ' : '⏸ Inactiv'}
						</span>
					</div>

					{#if treatment.description}
						<p class="text-gray-700 dark:text-gray-300 text-sm mb-4 line-clamp-2">{treatment.description}</p>
					{/if}

					<div class="space-y-2 text-sm mb-4">
						{#if $isMedic}
								<div class="flex items-center text-gray-700 dark:text-gray-300">
								<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
									/>
								</svg>
								<span>{treatment.patientName}</span>
							</div>
						{:else}
							<div class="flex items-center text-gray-700 dark:text-gray-300">
								<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
									/>
								</svg>
								<span>Dr. {treatment.doctorName}</span>
							</div>
						{/if}

						<div class="flex items-center text-gray-700 dark:text-gray-300">
							<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
								/>
							</svg>
							<span>{new Date(treatment.createdAt).toLocaleDateString('ro-RO')}</span>
						</div>
					</div>

					<div class="flex items-center justify-end pt-3 border-t border-gray-100 dark:border-gray-700">
						<span class="text-sm text-blue-600 dark:text-blue-400 font-medium group-hover:underline">Vezi detalii →</span>
					</div>
				</button>
				{/each}
			</div>
		{/if}
	{/if}
	</main>

	<Modal
		isOpen={showNewTreatmentModal}
		title="📋 Tratament Nou"
		size="md"
		showCancel={true}
		confirmText={isSubmitting ? 'Se salvează...' : 'Creează'}
		cancelText="Anulează"
		isLoading={isSubmitting}
		onConfirm={handleCreateTreatment}
		onCancel={closeNewTreatmentModal}
		onClose={closeNewTreatmentModal}
	>
		<div class="space-y-4">
			{#if loadingCollabs}
				<div class="flex justify-center py-4">
					<div class="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
				</div>
			{:else}
				<div>
					<label for="patient" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Pacient *
					</label>
					<select
						id="patient"
						bind:value={formData.patientId}
						required
						class="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 truncate"
					>
						<option value="">Selectează pacient</option>
						{#each collaborations as collab}
							{#if collab.patientId}
								<option value={collab.patientId}>
									{collab.patientName}
								</option>
							{/if}
						{/each}
					</select>
				</div>

				<div>
					<label for="diagnostic" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Diagnostic *
					</label>
					<input
						id="diagnostic"
						type="text"
						bind:value={formData.diagnostic}
						required
						placeholder="ex: Hipertensiune arterială"
						class="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
					/>
				</div>

				<div>
					<label for="descriere" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Descriere
					</label>
					<textarea
						id="descriere"
						bind:value={formData.descriere}
						rows="3"
						placeholder="Descrierea completă a tratamentului..."
						class="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 resize-none"
					></textarea>
				</div>
			{/if}
		</div>
	</Modal>
{/if}