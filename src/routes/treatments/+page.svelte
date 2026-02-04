<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, afterNavigate } from '$app/navigation';
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

	// Refresh treatments when navigating back to this page
	afterNavigate(() => {
		if ($page.url.pathname === '/treatments' && $authStore.isAuthenticated) {
			loadTreatments();
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
	<main class="page-transition mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
		<div class="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<h1
					class="mb-2 flex items-center gap-2 text-2xl font-bold text-gray-900 sm:text-3xl dark:text-slate-100"
				>
					<ClipboardList class="h-6 w-6 text-gray-900 dark:text-slate-100" />
					Planuri de Tratament
				</h1>
				<p class="text-sm font-medium text-gray-900 sm:text-base dark:text-slate-100">
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
					class="flex w-full flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold whitespace-nowrap text-white transition hover:bg-blue-700 sm:w-auto"
				>
					<Plus class="h-5 w-5" />
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
				<AlertCircle
					class="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 sm:h-6 sm:w-6 dark:text-red-400"
				/>
				<p class="text-sm font-medium text-red-800 sm:text-base dark:text-red-400">{error}</p>
			</Alert>
		{/if}

		{#if isAdmin}
			<!-- Admin View: Global Statistics -->
			{#if loading}
				<div class="flex justify-center py-16">
					<div
						class="h-12 w-12 animate-spin rounded-full border-3 border-blue-600 border-t-transparent shadow-lg shadow-blue-500/50"
					></div>
				</div>
			{:else if overview}
				<!-- Stats Cards -->
				<div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
					<Card
						renderCustom
						unstyled
						containerClass="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border border-green-200 dark:border-green-700/50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 shadow-sm dark:shadow-md"
					>
						<div class="mb-2 flex items-center gap-1.5 sm:gap-2">
							<CheckCircle2 class="h-4 w-4 text-green-700 sm:h-5 sm:w-5 dark:text-green-200" />
							<h3
								class="truncate text-xs font-semibold text-green-900 sm:text-sm dark:text-green-200"
							>
								Active
							</h3>
						</div>
						<p
							class="mb-1 text-xl font-bold text-green-900 sm:text-2xl md:text-3xl dark:text-green-100"
						>
							{overview.treatments.active ?? 0}
						</p>
						<p class="truncate text-xs text-green-700 dark:text-green-300">În derulare</p>
					</Card>

					<Card
						renderCustom
						unstyled
						containerClass="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-950 dark:to-slate-900 border border-gray-200 dark:border-slate-700/50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 shadow-sm dark:shadow-md"
					>
						<div class="mb-2 flex items-center gap-1.5 sm:gap-2">
							<PauseCircle class="h-4 w-4 text-slate-700 sm:h-5 sm:w-5 dark:text-slate-200" />
							<h3
								class="truncate text-xs font-semibold text-gray-900 sm:text-sm dark:text-slate-200"
							>
								Inactive
							</h3>
						</div>
						<p
							class="mb-1 text-xl font-bold text-gray-900 sm:text-2xl md:text-3xl dark:text-slate-100"
						>
							{overview.treatments.inactive ?? 0}
						</p>
						<p class="truncate text-xs text-gray-700 dark:text-slate-400">Finalizate</p>
					</Card>

					<Card
						renderCustom
						unstyled
						containerClass="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border border-blue-200 dark:border-blue-700/50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 shadow-sm dark:shadow-md"
					>
						<div class="mb-2 flex items-center gap-1.5 sm:gap-2">
							<BarChart3 class="h-4 w-4 text-blue-700 sm:h-5 sm:w-5 dark:text-blue-200" />
							<h3
								class="truncate text-xs font-semibold text-blue-900 sm:text-sm dark:text-blue-200"
							>
								Total
							</h3>
						</div>
						<p
							class="mb-1 text-xl font-bold text-blue-900 sm:text-2xl md:text-3xl dark:text-blue-100"
						>
							{overview.treatments.total ?? 0}
						</p>
						<p class="truncate text-xs text-blue-700 dark:text-blue-300">În sistem</p>
					</Card>
				</div>

				<!-- Detailed Breakdown -->
				<div class="grid gap-4 sm:gap-6 md:grid-cols-2">
					<!-- Status Breakdown -->
					<Card
						renderCustom
						containerClass="p-0 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg"
					>
						<div
							class="border-b border-gray-200 bg-slate-50/50 p-4 sm:p-6 dark:border-slate-700 dark:bg-slate-800/50"
						>
							<h2
								class="flex items-center gap-2 text-base font-semibold text-gray-900 sm:text-lg dark:text-slate-100"
							>
								<BarChart3 class="h-4 w-4 text-gray-700 sm:h-5 sm:w-5 dark:text-slate-200" />
								Detalii Status
							</h2>
							<p class="mt-1 text-xs text-gray-700 dark:text-slate-300">Distribuție pe statusuri</p>
						</div>
						<div class="space-y-4 p-4 sm:p-6">
							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<CheckCircle2
											class="h-4 w-4 text-green-700 sm:h-5 sm:w-5 dark:text-green-200"
										/>
										<span
											class="text-sm font-medium text-green-900 sm:text-base dark:text-green-100"
											>Active</span
										>
									</div>
									<span class="text-lg font-bold text-gray-900 sm:text-xl dark:text-slate-100"
										>{overview.treatments.active ?? 0}</span
									>
								</div>
								<!-- Progress bar -->
								<div
									class="h-2 w-full overflow-hidden rounded-full bg-gray-200 sm:h-2.5 dark:bg-slate-700"
								>
									<div
										class="h-full rounded-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
										style="width: {overview.treatments.total > 0
											? (overview.treatments.active / overview.treatments.total) * 100
											: 0}%"
									></div>
								</div>
								<div class="text-xs text-gray-700 dark:text-slate-200">
									{overview.treatments.total > 0
										? Math.round((overview.treatments.active / overview.treatments.total) * 100)
										: 0}% din total
								</div>
							</div>

							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<PauseCircle class="h-4 w-4 text-slate-700 sm:h-5 sm:w-5 dark:text-slate-200" />
										<span class="text-sm font-medium text-gray-900 sm:text-base dark:text-slate-100"
											>Inactive</span
										>
									</div>
									<span class="text-lg font-bold text-gray-900 sm:text-xl dark:text-slate-100"
										>{overview.treatments.inactive ?? 0}</span
									>
								</div>
								<!-- Progress bar -->
								<div
									class="h-2 w-full overflow-hidden rounded-full bg-gray-200 sm:h-2.5 dark:bg-slate-700"
								>
									<div
										class="h-full rounded-full bg-gradient-to-r from-gray-500 to-gray-600 transition-all duration-500"
										style="width: {overview.treatments.total > 0
											? (overview.treatments.inactive / overview.treatments.total) * 100
											: 0}%"
									></div>
								</div>
								<div class="text-xs text-gray-700 dark:text-slate-200">
									{overview.treatments.total > 0
										? Math.round((overview.treatments.inactive / overview.treatments.total) * 100)
										: 0}% din total
								</div>
							</div>

							<!-- Summary -->
							<div class="mt-4 space-y-2 border-t border-gray-200 pt-4 dark:border-slate-700">
								<div class="flex justify-between text-sm">
									<span class="text-gray-700 dark:text-slate-200">Total tratamente:</span>
									<span class="font-bold text-gray-900 dark:text-slate-100">
										{overview.treatments.total ?? 0}
									</span>
								</div>
								<div class="flex justify-between text-sm">
									<span class="text-gray-700 dark:text-slate-200">Rata activare:</span>
									<span
										class="font-bold {overview.treatments.total > 0 &&
										overview.treatments.active / overview.treatments.total > 0.7
											? 'text-green-600 dark:text-green-400'
											: 'text-yellow-600 dark:text-yellow-400'}"
									>
										{overview.treatments.total > 0
											? Math.round((overview.treatments.active / overview.treatments.total) * 100)
											: 0}%
									</span>
								</div>
							</div>
						</div>
					</Card>

					<!-- Quick Actions -->
					<Card
						renderCustom
						containerClass="p-0 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm dark:shadow-lg"
					>
						<div
							class="border-b border-gray-200 bg-slate-50/50 p-4 sm:p-6 dark:border-slate-700 dark:bg-slate-800/50"
						>
							<h2
								class="flex items-center gap-2 text-base font-semibold text-gray-900 sm:text-lg dark:text-slate-100"
							>
								<Zap class="h-4 w-4 text-gray-700 sm:h-5 sm:w-5 dark:text-slate-200" />
								Acțiuni Rapide
							</h2>
							<p class="mt-1 text-xs text-gray-700 dark:text-slate-300">Administrare sistem</p>
						</div>
						<div class="space-y-3 p-4 sm:p-6">
							<a
								href="/admin/users"
								class="block rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-4 transition-all duration-200 hover:scale-105 hover:shadow-lg dark:border-blue-700/50 dark:from-blue-950 dark:to-blue-900"
							>
								<div class="flex items-center gap-3">
									<Users class="h-6 w-6 text-blue-700 sm:h-7 sm:w-7 dark:text-blue-200" />
									<div class="min-w-0 flex-1">
										<h3
											class="truncate text-sm font-semibold text-blue-900 sm:text-base dark:text-blue-200"
										>
											Gestionează Utilizatori
										</h3>
										<p class="truncate text-xs text-blue-700 dark:text-blue-300">
											Vezi toți utilizatorii
										</p>
									</div>
									<ChevronRight class="h-5 w-5 flex-shrink-0 text-blue-400 dark:text-blue-300" />
								</div>
							</a>

							<a
								href="/admin/reports"
								class="block rounded-lg border border-green-200 bg-gradient-to-br from-green-50 to-green-100 p-4 transition-all duration-200 hover:scale-105 hover:shadow-lg dark:border-green-700/50 dark:from-green-950 dark:to-green-900"
							>
								<div class="flex items-center gap-3">
									<BarChart3 class="h-6 w-6 text-green-700 sm:h-7 sm:w-7 dark:text-green-200" />
									<div class="min-w-0 flex-1">
										<h3
											class="truncate text-sm font-semibold text-green-900 sm:text-base dark:text-green-200"
										>
											Rapoarte Detaliate
										</h3>
										<p class="truncate text-xs text-green-700 dark:text-green-300">
											Export și analize
										</p>
									</div>
									<ChevronRight class="h-5 w-5 flex-shrink-0 text-green-400 dark:text-green-300" />
								</div>
							</a>

							<a
								href="/dashboard"
								class="block rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 p-4 transition-all duration-200 hover:scale-105 hover:shadow-lg dark:border-purple-700/50 dark:from-purple-950 dark:to-purple-900"
							>
								<div class="flex items-center gap-3">
									<LineChart class="h-6 w-6 text-purple-700 sm:h-7 sm:w-7 dark:text-purple-200" />
									<div class="min-w-0 flex-1">
										<h3
											class="truncate text-sm font-semibold text-purple-900 sm:text-base dark:text-purple-200"
										>
											Dashboard Admin
										</h3>
										<p class="truncate text-xs text-purple-700 dark:text-purple-300">
											Overview complet
										</p>
									</div>
									<ChevronRight
										class="h-5 w-5 flex-shrink-0 text-purple-400 dark:text-purple-300"
									/>
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
					<div
						class="h-14 w-14 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
					></div>
				</div>
			{:else if error}
				<Alert
					containerClass="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-6 flex items-start gap-3 animate-shake"
				>
					<AlertCircle class="mt-0.5 h-6 w-6 flex-shrink-0 text-red-600 dark:text-red-400" />
					<p class="font-medium text-red-800 dark:text-red-400">{error}</p>
				</Alert>
			{:else if treatments.length === 0}
				<Card
					renderCustom
					containerClass="bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-2xl shadow-sm p-16 text-center animate-scale-in"
				>
					<div class="mx-auto max-w-sm">
						<ClipboardList class="mx-auto mb-4 h-20 w-20 text-gray-300 dark:text-slate-600" />
						<h3 class="mb-2 text-xl font-semibold text-gray-900 dark:text-slate-100">
							Niciun tratament încă
						</h3>
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
							<div class="mb-4 flex items-start gap-3">
								<h3
									class="min-w-0 flex-1 text-lg font-bold text-gray-900 transition group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400"
								>
									{treatment.diagnosis}
								</h3>
								<span
									class="inline-flex flex-shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap shadow-sm"
									class:bg-green-500={treatment.isActive}
									class:text-white={treatment.isActive}
									class:bg-gray-100={!treatment.isActive}
									class:text-gray-600={!treatment.isActive}
								>
									{#if treatment.isActive}
										<CheckCircle2 class="h-4 w-4" />
									{:else}
										<PauseCircle class="h-4 w-4" />
									{/if}
									{treatment.isActive ? 'Activ' : 'Inactiv'}
								</span>
							</div>

							{#if treatment.description}
								<p class="mb-4 line-clamp-2 text-sm text-gray-700 dark:text-slate-200">
									{treatment.description}
								</p>
							{/if}

							<div class="mb-4 space-y-2 text-sm">
								{#if $isMedic}
									<div class="flex items-center text-gray-700 dark:text-slate-200">
										<User class="mr-2 h-4 w-4" />
										<span>{treatment.patientName}</span>
									</div>
								{:else}
									<div class="flex items-center text-gray-700 dark:text-slate-200">
										<User class="mr-2 h-4 w-4" />
										<span>Dr. {treatment.doctorName}</span>
									</div>
								{/if}

								<div class="flex items-center text-gray-700 dark:text-slate-200">
									<CalendarDays class="mr-2 h-4 w-4" />
									<span
										>{treatment.createdAt
											? new Date(treatment.createdAt).toLocaleDateString('ro-RO')
											: new Date(treatment.startDate).toLocaleDateString('ro-RO')}</span
									>
								</div>
							</div>

							<div
								class="flex items-center justify-end border-t border-gray-100 pt-3 dark:border-slate-700"
							>
								<span
									class="text-sm font-medium text-blue-600 group-hover:underline dark:text-blue-400"
									>Vezi detalii →</span
								>
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
					<div
						class="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
					></div>
				</div>
			{:else}
				<div>
					<label
						for="patient"
						class="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-200"
					>
						Pacient *
					</label>
					<select
						id="patient"
						bind:value={formData.patientId}
						required
						class="w-full truncate rounded-lg border border-slate-300 bg-white/95 px-4 py-3 text-gray-900 backdrop-blur-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900/95 dark:text-slate-100"
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
					<label
						for="diagnostic"
						class="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-200"
					>
						Diagnostic *
					</label>
					<input
						id="diagnostic"
						type="text"
						bind:value={formData.diagnostic}
						required
						placeholder="ex: Hipertensiune arterială"
						class="w-full rounded-lg border border-slate-300 bg-white/95 px-4 py-3 text-gray-900 backdrop-blur-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900/95 dark:text-slate-100"
						aria-describedby={error ? 'treatment-error' : undefined}
					/>
				</div>

				<div>
					<label
						for="descriere"
						class="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-200"
					>
						Descriere
					</label>
					<textarea
						id="descriere"
						bind:value={formData.descriere}
						rows="3"
						placeholder="Descrierea completă a tratamentului..."
						class="w-full resize-none rounded-lg border border-slate-300 bg-white/95 px-4 py-3 text-gray-900 backdrop-blur-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900/95 dark:text-slate-100"
						aria-describedby={error ? 'treatment-error' : undefined}
					></textarea>
				</div>
			{/if}
		</div>
	</Modal>
{/if}
