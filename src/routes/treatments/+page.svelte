<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { authStore, isMedic } from '$lib/stores/auth';
	import { api, adminReportsApi } from '$lib/api/client';
	import Modal from '$lib/components/Modal.svelte';
	import Card from '$lib/components/Card.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import type { Treatment, Collaboration, AdminOverview } from '$lib/types/api';
	import {
		AlertCircle,
		BarChart3,
		CalendarDays,
		CheckCircle2,
		ChevronRight,
		ClipboardList,
		LineChart,
		PauseCircle,
		Plus,
		User,
		Users,
		Zap
	} from '@lucide/svelte';
	import { loadCollaborations as loadCollabs } from '$lib/utils/loaders';
	import { treatmentSchema, parseWithFriendlyErrors } from '$lib/validation/schemas';

	let treatments = $state<Treatment[]>([]);
	let overview = $state<AdminOverview | null>(null);
	let loading = $state(true);
	let error = $state('');
	let showNewTreatmentModal = $state(false);
	let isSubmitting = $state(false);
	let collaborations = $state<Collaboration[]>([]);
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

	// Refresh treatments when returning to this page (e.g., after deleting a treatment)
	$effect(() => {
		// Watch for page changes - when user navigates back to /treatments
		const currentPath = $page.url.pathname;
		if (currentPath === '/treatments' && !loading && $authStore.isAuthenticated) {
			// Small delay to ensure navigation is complete
			const timeoutId = setTimeout(() => {
				loadTreatments();
			}, 100);
			return () => clearTimeout(timeoutId);
		}
	});

	async function loadTreatments() {
		try {
			loading = true;
			error = '';
			
			if (isAdmin) {
				// Admin loads global overview
				overview = await adminReportsApi.getOverview();
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
				<h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2 flex items-center gap-2">
					<ClipboardList class="w-6 h-6 text-gray-900 dark:text-slate-100" />
					Planuri de Tratament
				</h1>
				<p class="text-sm sm:text-base text-gray-900 dark:text-slate-100 font-medium">
					{#if isAdmin}
					Gestionare completă planuri tratament, doze și monitorizare pacienți
					{:else if $isMedic}
					Gestionare tratamente pacienți, programare doze și monitorizare progres
				{:else}
					Vizualizare planuri personale, programare doze și urmărire aderență
					{/if}
				</p>
			</div>
			{#if $isMedic}
				<button
					onclick={openNewTreatmentModal}
					class="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2 whitespace-nowrap flex-shrink-0"
				>
					<Plus class="w-5 h-5" />
					Tratament Nou
				</button>
			{/if}
		</div>

		{#if error}
			<Alert
				containerClass="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-4 sm:p-6 mb-6 flex items-start gap-3 animate-shake"
				role="alert"
				ariaLive="assertive"
			>
				<AlertCircle class="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
				<p class="text-sm sm:text-base text-red-800 dark:text-red-400 font-medium">{error}</p>
			</Alert>
		{/if}

		{#if isAdmin}
			<!-- Admin View: Global Statistics -->
			{#if loading}
				<div class="flex justify-center py-16">
					<div class="animate-spin rounded-full h-12 w-12 border-3 border-blue-600 border-t-transparent shadow-lg shadow-blue-500/50"></div>
				</div>
			{:else if overview}
				<!-- Stats Cards -->
				<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
					<Card renderCustom unstyled containerClass="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border border-green-200 dark:border-green-700/50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 shadow-sm dark:shadow-md">
					<div class="flex items-center gap-1.5 sm:gap-2 mb-2">
						<CheckCircle2 class="w-4 h-4 sm:w-5 sm:h-5 text-green-700 dark:text-green-200" />
						<h3 class="text-xs sm:text-sm font-semibold text-green-900 dark:text-green-200 truncate">Active</h3>
					</div>
					<p class="text-xl sm:text-2xl md:text-3xl font-bold text-green-900 dark:text-green-100 mb-1">
					{overview.treatments.active ?? 0}
					</p>
					<p class="text-xs text-green-700 dark:text-green-300 truncate">În derulare</p>
					</Card>

					<Card renderCustom unstyled containerClass="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-950 dark:to-slate-900 border border-gray-200 dark:border-slate-700/50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 shadow-sm dark:shadow-md">
					<div class="flex items-center gap-1.5 sm:gap-2 mb-2">
						<PauseCircle class="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 dark:text-slate-200" />
						<h3 class="text-xs sm:text-sm font-semibold text-gray-900 dark:text-slate-200 truncate">Inactive</h3>
					</div>
					<p class="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-slate-100 mb-1">
					{overview.treatments.inactive ?? 0}
					</p>
					<p class="text-xs text-gray-700 dark:text-slate-400 truncate">Finalizate</p>
					</Card>

					<Card renderCustom unstyled containerClass="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border border-blue-200 dark:border-blue-700/50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 shadow-sm dark:shadow-md">
					<div class="flex items-center gap-1.5 sm:gap-2 mb-2">
						<BarChart3 class="w-4 h-4 sm:w-5 sm:h-5 text-blue-700 dark:text-blue-200" />
						<h3 class="text-xs sm:text-sm font-semibold text-blue-900 dark:text-blue-200 truncate">Total</h3>
					</div>
					<p class="text-xl sm:text-2xl md:text-3xl font-bold text-blue-900 dark:text-blue-100 mb-1">
					{overview.treatments.total ?? 0}
					</p>
					<p class="text-xs text-blue-700 dark:text-blue-300 truncate">În sistem</p>
					</Card>
				</div>

				<!-- Detailed Breakdown -->
				<div class="grid gap-4 sm:gap-6 md:grid-cols-2">
					<!-- Status Breakdown -->
					<Card renderCustom containerClass="p-0 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg">
						<div class="p-4 sm:p-6 border-b border-gray-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
						<h2 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
							<BarChart3 class="w-4 h-4 sm:w-5 sm:h-5 text-gray-700 dark:text-slate-200" />
									Detalii Status
							</h2>
							<p class="text-xs text-gray-700 dark:text-slate-300 mt-1">Distribuție pe statusuri</p>
						</div>
						<div class="p-4 sm:p-6 space-y-4">
							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<CheckCircle2 class="w-4 h-4 sm:w-5 sm:h-5 text-green-700 dark:text-green-200" />
										<span class="text-sm sm:text-base font-medium text-green-900 dark:text-green-100">Active</span>
									</div>
									<span class="text-lg sm:text-xl font-bold text-gray-900 dark:text-slate-100">{overview.treatments.active ?? 0}</span>
								</div>
								<!-- Progress bar -->
								<div class="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 sm:h-2.5 overflow-hidden">
									<div 
										class="bg-gradient-to-r from-green-500 to-green-600 h-full transition-all duration-500 rounded-full"
										style="width: {overview.treatments.total > 0 ? (overview.treatments.active / overview.treatments.total) * 100 : 0}%"
									></div>
								</div>
								<div class="text-xs text-gray-700 dark:text-slate-200">
									{overview.treatments.total > 0 ? Math.round((overview.treatments.active / overview.treatments.total) * 100) : 0}% din total
								</div>
							</div>

							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<PauseCircle class="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 dark:text-slate-200" />
										<span class="text-sm sm:text-base font-medium text-gray-900 dark:text-slate-100">Inactive</span>
									</div>
									<span class="text-lg sm:text-xl font-bold text-gray-900 dark:text-slate-100">{overview.treatments.inactive ?? 0}</span>
								</div>
								<!-- Progress bar -->
								<div class="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 sm:h-2.5 overflow-hidden">
									<div 
										class="bg-gradient-to-r from-gray-500 to-gray-600 h-full transition-all duration-500 rounded-full"
										style="width: {overview.treatments.total > 0 ? (overview.treatments.inactive / overview.treatments.total) * 100 : 0}%"
									></div>
								</div>
								<div class="text-xs text-gray-700 dark:text-slate-200">
									{overview.treatments.total > 0 ? Math.round((overview.treatments.inactive / overview.treatments.total) * 100) : 0}% din total
								</div>
							</div>
							
							<!-- Summary -->
							<div class="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 space-y-2">
								<div class="flex justify-between text-sm">
									<span class="text-gray-700 dark:text-slate-200">Total tratamente:</span>
									<span class="font-bold text-gray-900 dark:text-slate-100">
									{overview.treatments.total ?? 0}
									</span>
								</div>
								<div class="flex justify-between text-sm">
									<span class="text-gray-700 dark:text-slate-200">Rata activare:</span>
									<span class="font-bold {overview.treatments.total > 0 && (overview.treatments.active / overview.treatments.total) > 0.7 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}">
										{overview.treatments.total > 0 ? Math.round((overview.treatments.active / overview.treatments.total) * 100) : 0}%
									</span>
								</div>
							</div>
						</div>
					</Card>

					<!-- Quick Actions -->
					<Card renderCustom containerClass="p-0 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg">
						<div class="p-4 sm:p-6 border-b border-gray-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
						<h2 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
							<Zap class="w-4 h-4 sm:w-5 sm:h-5 text-gray-700 dark:text-slate-200" />
							Acțiuni Rapide
						</h2>
						<p class="text-xs text-gray-700 dark:text-slate-300 mt-1">Administrare sistem</p>
						</div>
						<div class="p-4 sm:p-6 space-y-3">
							<a
								href="/admin/users"
							class="block p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border border-blue-200 dark:border-blue-700/50 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200"
						>
							<div class="flex items-center gap-3">
								<Users class="w-6 h-6 sm:w-7 sm:h-7 text-blue-700 dark:text-blue-200" />
								<div class="flex-1 min-w-0">
									<h3 class="text-sm sm:text-base font-semibold text-blue-900 dark:text-blue-200 truncate">Gestionează Utilizatori</h3>
									<p class="text-xs text-blue-700 dark:text-blue-300 truncate">Vezi toți utilizatorii</p>
								</div>
								<ChevronRight class="w-5 h-5 text-blue-400 dark:text-blue-300 flex-shrink-0" />
							</div>
						</a>

						<a
								href="/admin/reports"
								class="block p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border border-green-200 dark:border-green-700/50 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200"
							>
								<div class="flex items-center gap-3">
									<BarChart3 class="w-6 h-6 sm:w-7 sm:h-7 text-green-700 dark:text-green-200" />
									<div class="flex-1 min-w-0">
										<h3 class="text-sm sm:text-base font-semibold text-green-900 dark:text-green-200 truncate">Rapoarte Detaliate</h3>
										<p class="text-xs text-green-700 dark:text-green-300 truncate">Export și analize</p>
									</div>
									<ChevronRight class="w-5 h-5 text-green-400 dark:text-green-300 flex-shrink-0" />
								</div>
							</a>

							<a
								href="/dashboard"
								class="block p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border border-purple-200 dark:border-purple-700/50 rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200"
							>
								<div class="flex items-center gap-3">
									<LineChart class="w-6 h-6 sm:w-7 sm:h-7 text-purple-700 dark:text-purple-200" />
									<div class="flex-1 min-w-0">
										<h3 class="text-sm sm:text-base font-semibold text-purple-900 dark:text-purple-200 truncate">Dashboard Admin</h3>
										<p class="text-xs text-purple-700 dark:text-purple-300 truncate">Overview complet</p>
									</div>
									<ChevronRight class="w-5 h-5 text-purple-400 dark:text-purple-300 flex-shrink-0" />
								</div>
							</a>
						</div>
					</Card>
				</div>
			{/if}
		{:else}
			<!-- Regular User View -->
			{#if loading}
				<div class="flex justify-center py-20">
					<div class="animate-spin rounded-full h-14 w-14 border-4 border-blue-600 border-t-transparent"></div>
				</div>
			{:else if error}
				<Alert containerClass="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-6 flex items-start gap-3 animate-shake">
					<AlertCircle class="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
					<p class="text-red-800 dark:text-red-400 font-medium">{error}</p>
				</Alert>
			{:else if treatments.length === 0}
				<Card renderCustom containerClass="bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-2xl shadow-sm p-16 text-center animate-scale-in">
					<div class="max-w-sm mx-auto">
						<ClipboardList class="mx-auto h-20 w-20 text-gray-300 dark:text-slate-600 mb-4" />
						<h3 class="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">Niciun tratament încă</h3>
						<p class="text-gray-700 dark:text-slate-200">
							{#if $isMedic}
								Începe prin a crea un plan de tratament pentru unul dintre pacienții tăi
							{:else}
								Medicul tău va crea planuri de tratament aici
							{/if}
						</p>
					</div>
				</Card>
		{:else}
			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each treatments as treatment}
				<Card
					href={`/treatments/${treatment.planId}`}
					renderCustom
					unstyled
					containerClass="bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-xl shadow-sm p-6 hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-600 transition cursor-pointer group text-left w-full"
					ariaLabel={`Vezi detalii pentru ${treatment.diagnosis}`}
				>
					<div class="flex items-start gap-3 mb-4">
						<h3 class="text-lg font-bold text-gray-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition flex-1 min-w-0">
							{treatment.diagnosis}
						</h3>
						<span
							class="px-3 py-1 text-xs font-semibold rounded-full shadow-sm inline-flex items-center gap-1 whitespace-nowrap flex-shrink-0"
							class:bg-green-500={treatment.isActive}
							class:text-white={treatment.isActive}
							class:bg-gray-100={!treatment.isActive}
							class:text-gray-600={!treatment.isActive}
						>
							{#if treatment.isActive}
								<CheckCircle2 class="w-4 h-4" />
							{:else}
								<PauseCircle class="w-4 h-4" />
							{/if}
						{treatment.isActive ? 'Activ' : 'Inactiv'}
						</span>
					</div>

					{#if treatment.description}
						<p class="text-gray-700 dark:text-slate-200 text-sm mb-4 line-clamp-2">{treatment.description}</p>
					{/if}

					<div class="space-y-2 text-sm mb-4">
						{#if $isMedic}
							<div class="flex items-center text-gray-700 dark:text-slate-200">
								<User class="w-4 h-4 mr-2" />
								<span>{treatment.patientName}</span>
							</div>
						{:else}
							<div class="flex items-center text-gray-700 dark:text-slate-200">
								<User class="w-4 h-4 mr-2" />
								<span>Dr. {treatment.doctorName}</span>
							</div>
						{/if}

					<div class="flex items-center text-gray-700 dark:text-slate-200">
						<CalendarDays class="w-4 h-4 mr-2" />
						<span>{treatment.createdAt ? new Date(treatment.createdAt).toLocaleDateString('ro-RO') : new Date(treatment.startDate).toLocaleDateString('ro-RO')}</span>
					</div>
					</div>

					<div class="flex items-center justify-end pt-3 border-t border-gray-100 dark:border-slate-700">
						<span class="text-sm text-blue-600 dark:text-blue-400 font-medium group-hover:underline">Vezi detalii →</span>
					</div>
				</Card>
				{/each}
			</div>
		{/if}
	{/if}
	</main>

	<Modal
		isOpen={showNewTreatmentModal}
		title="Tratament Nou"
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
					<label for="patient" class="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
						Pacient *
					</label>
					<select
						id="patient"
						bind:value={formData.patientId}
						required
						class="w-full px-4 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100 truncate"
							aria-describedby={error ? 'treatment-error' : undefined}
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
					<label for="diagnostic" class="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
						Diagnostic *
					</label>
					<input
						id="diagnostic"
						type="text"
						bind:value={formData.diagnostic}
						required
						placeholder="ex: Hipertensiune arterială"
						class="w-full px-4 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100"
							aria-describedby={error ? 'treatment-error' : undefined}
					/>
				</div>

				<div>
					<label for="descriere" class="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
						Descriere
					</label>
					<textarea
						id="descriere"
						bind:value={formData.descriere}
						rows="3"
						placeholder="Descrierea completă a tratamentului..."
						class="w-full px-4 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100 resize-none"
							aria-describedby={error ? 'treatment-error' : undefined}
					></textarea>
				</div>
			{/if}
		</div>
	</Modal>
{/if}