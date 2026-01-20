<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { authStore, isMedic } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	const planIdParam = $derived($page.params.planId ?? '0');
	let planId = $derived(parseInt(planIdParam, 10));
	let treatment = $state<any>(null);
	let medications = $state<any[]>([]);
	let loading = $state(true);
	let error = $state('');
	let showAddMedication = $state(false);
	let editingMedication = $state<any>(null);
	let editingTreatment = $state(false);
	let treatmentForm = $state({
		diagnostic: '',
		descriere: ''
	});

	let deleteConfirmToken = $state<string | null>(null);
	let deleteExpiresAt = $state<number | null>(null);
	let deleteCountdown = $state<number>(0);
	let deleteCountdownTimer: ReturnType<typeof setInterval> | null = null;

	function formatDate(value: string | Date) {
		if (!value) return '–';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return '–';
		return d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
	}

	function formatTime(value: string) {
		if (!value) return '–';
		return value.slice(0, 5);
	}

	// Add medication form
	let newMedication = $state({
		medicationName: '',
		cantitate: '',
		ora: '',
		frecventa: 'zilnic',
		startDate: '',
		endDate: '',
		instructiuni: '',
		detaliiMedicament: ''
	});

	onMount(async () => {
		if (!$authStore.isAuthenticated) {
			goto('/');
			return;
		}
		if (Number.isNaN(planId)) {
			goto('/treatments');
			return;
		}
		await loadTreatmentDetails();
	});

	onDestroy(() => {
		clearDeleteTimers();
	});

	async function loadTreatmentDetails() {
		try {
			loading = true;
			error = '';
			const [treatmentData, medicationsData] = await Promise.all([
				api.getTreatmentDetails(planId),
				api.getMedicationsForPlan(planId)
			]);
			treatment = treatmentData;
			medications = medicationsData;
			resetDeleteState();
		} catch (err: any) {
			console.error('Failed to load treatment:', err);
			error = err.message || 'Nu s-au putut încărca detaliile tratamentului';
		} finally {
			loading = false;
		}
	}

	function clearDeleteTimers() {
		if (deleteCountdownTimer) {
			clearInterval(deleteCountdownTimer);
			deleteCountdownTimer = null;
		}
	}

	function resetDeleteState() {
		clearDeleteTimers();
		deleteConfirmToken = null;
		deleteExpiresAt = null;
		deleteCountdown = 0;
	}

	async function startTreatmentDelete() {
		try {
			const response = await api.deleteTreatment(planId);
			deleteConfirmToken = response.confirmToken;
			deleteExpiresAt = response.expiresAt;
			updateCountdown();
			deleteCountdownTimer = setInterval(updateCountdown, 250);
			alert('Confirmă în 5 secunde pentru a șterge planul');
		} catch (err: any) {
			resetDeleteState();
			alert('Nu s-a putut iniția ștergerea');
		}
	}

	function updateCountdown() {
		if (!deleteExpiresAt) return;
		const remainingMs = deleteExpiresAt - Date.now();
		deleteCountdown = Math.max(0, Math.ceil(remainingMs / 1000));
		if (remainingMs <= 0) {
			resetDeleteState();
			alert('Fereastra de confirmare a expirat');
		}
	}

	async function confirmTreatmentDelete() {
		if (!deleteConfirmToken) return;
		try {
			await api.deleteTreatment(planId, deleteConfirmToken);
			alert('Planul de tratament a fost șters');
			resetDeleteState();
			goto('/treatments');
		} catch (err: any) {
			alert('Nu s-a putut șterge planul');
			resetDeleteState();
		}
	}

	async function handleAddMedication() {
		try {
			await api.addMedication({
				planId,
				medicationName: newMedication.medicationName,
				cantitate: newMedication.cantitate,
				ora: newMedication.ora,
				frecventa: newMedication.frecventa,
				startDate: newMedication.startDate,
				endDate: newMedication.endDate || undefined,
				instructiuni: newMedication.instructiuni,
				detaliiMedicament: newMedication.detaliiMedicament || newMedication.medicationName
			});

			alert('Medicament adăugat cu succes');

			showAddMedication = false;
			newMedication = {
				medicationName: '',
				cantitate: '',
				ora: '',
				frecventa: 'zilnic',
				startDate: '',
				endDate: '',
				instructiuni: '',
				detaliiMedicament: ''
			};

			await loadTreatmentDetails();
		} catch (err: any) {
			console.error('Failed to add medication:', err);
			alert('Nu s-a putut adăuga medicamentul');
		}
	}

	function startEditMedication(med: any) {
		editingMedication = med;
		newMedication.medicationName = med.medicationName;
		newMedication.cantitate = med.quantity;
		newMedication.ora = med.time;
		newMedication.frecventa = med.frequency;
		newMedication.startDate = med.startDate?.split('T')[0] || '';
		newMedication.endDate = med.endDate?.split('T')[0] || '';
		newMedication.instructiuni = med.instructions || '';
		// Preserve original details when present; fallback to medicationDetails from API
		newMedication.detaliiMedicament = med.detaliiMedicament || med.medicationDetails || '';
	}

	function cancelEdit() {
		editingMedication = null;
		showAddMedication = false; // close the edit/add form
		newMedication = {
			medicationName: '',
			cantitate: '',
			ora: '',
			frecventa: 'zilnic',
			startDate: '',
			endDate: '',
			instructiuni: '',
			detaliiMedicament: ''
		};
	}

	async function handleUpdateMedication() {
		if (!editingMedication) return;

		try {
			await api.updateMedication(editingMedication.doseId, {
				medicationName: newMedication.medicationName,
				cantitate: newMedication.cantitate,
				ora: newMedication.ora,
				frecventa: newMedication.frecventa,
				startDate: newMedication.startDate,
				endDate: newMedication.endDate || null,
				instructiuni: newMedication.instructiuni || null,
				detaliiMedicament: newMedication.detaliiMedicament || newMedication.medicationName
			});

			alert('Medicament actualizat');
			
			cancelEdit();
			await loadTreatmentDetails();
		} catch (err) {
			alert('Eroare la actualizarea medicamentului');
		}
	}

	async function handleDeleteMedication(doseId: number) {
		const confirmDelete = confirm('Ștergi acest medicament?');
		if (!confirmDelete) return;

		try {
			await api.deleteMedication(doseId);
			alert('Medicament șters cu succes');
			await loadTreatmentDetails();
		} catch (err: any) {
			alert('Nu s-a putut șterge medicamentul');
		}
	}

	function startEditTreatment() {
		editingTreatment = true;
		treatmentForm.diagnostic = treatment.diagnosis;
		treatmentForm.descriere = treatment.description || '';
	}

	function cancelTreatmentEdit() {
		editingTreatment = false;
		treatmentForm.diagnostic = '';
		treatmentForm.descriere = '';
	}

	async function handleUpdateTreatment() {
		try {
			await api.updateTreatment(planId, {
				diagnosis: treatmentForm.diagnostic,
				description: treatmentForm.descriere
			});

			alert('Tratament actualizat');

			cancelTreatmentEdit();
			await loadTreatmentDetails();
		} catch (err) {
			alert('Eroare la actualizarea tratamentului');
		}
	}
</script>

{#if $authStore.isAuthenticated}
	<main class="page-transition max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<div class="mb-6">
			<button
				onclick={() => goto('/treatments')}
				class="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
				</svg>
				Înapoi la tratamente
			</button>
		</div>

		{#if loading}
			<div class="flex justify-center py-20">
				<div class="animate-spin rounded-full h-14 w-14 border-4 border-blue-600 border-t-transparent"></div>
			</div>
		{:else if error}
			<div class="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-6">
				<p class="text-red-800 dark:text-red-400 font-medium">{error}</p>
			</div>
		{:else if treatment}
			<!-- Treatment Header -->
			<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6">
				{#if !editingTreatment}
					<div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
						<div class="flex-1 min-w-0">
					<h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 break-words">{treatment.diagnosis}</h1>
					<p class="text-gray-600 dark:text-gray-400 break-words">{treatment.description || 'Fără descriere'}</p>
				</div>
				<div class="flex items-center gap-3 flex-shrink-0">
					<span class="px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-full whitespace-nowrap {treatment.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400'}">
						{treatment.isActive ? 'Activ' : 'Inactiv'}
							</span>
							{#if $isMedic}
								{#if deleteConfirmToken}
									<div class="flex items-center gap-2">
										<button
											onclick={confirmTreatmentDelete}
											class="px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition whitespace-nowrap"
										>
											Confirmă ștergerea ({deleteCountdown}s)
										</button>
										<button
											onclick={resetDeleteState}
											class="px-3 sm:px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 text-xs sm:text-sm font-medium rounded-lg transition whitespace-nowrap"
										>
											Anulează
										</button>
									</div>
								{:else}
									<button
										onclick={startEditTreatment}
										class="px-3 sm:px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 text-xs sm:text-sm font-medium rounded-lg transition whitespace-nowrap"
									>
										✏️ Editează
									</button>
									<button
										onclick={startTreatmentDelete}
										class="px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition whitespace-nowrap"
									>
										🗑 Șterge
									</button>
								{/if}
							{/if}
						</div>
					</div>
				{:else}
					<div class="space-y-4">
						<h2 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Editează Tratament</h2>
						<form onsubmit={(e) => { e.preventDefault(); handleUpdateTreatment(); }} class="space-y-4">
							<div>
								<label for="edit-diagnostic" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Diagnostic *
								</label>
								<input
									id="edit-diagnostic"
									type="text"
									bind:value={treatmentForm.diagnostic}
									required
									class="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
								/>
							</div>
							<div>
								<label for="edit-descriere" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Descriere
								</label>
								<textarea
									id="edit-descriere"
									bind:value={treatmentForm.descriere}
									rows="4"
									class="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 resize-none"
								></textarea>
							</div>
							<div class="flex flex-col sm:flex-row gap-3">
								<button
									type="submit"
									class="w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
								>
									Salvează
								</button>
								<button
									type="button"
									onclick={cancelTreatmentEdit}
									class="w-full sm:w-auto px-6 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 font-semibold rounded-lg transition"
								>
									Anulează
								</button>
							</div>
						</form>
					</div>
				{/if}

				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm {editingTreatment ? 'mt-6 pt-6 border-t border-gray-200 dark:border-gray-700' : ''}">
					<div>
						<p class="text-gray-500 dark:text-gray-400">Pacient</p>
						<p class="font-semibold text-gray-900 dark:text-gray-100 truncate">{treatment.patientName}</p>
					</div>
					<div>
						<p class="text-gray-500 dark:text-gray-400">Medic</p>
						<p class="font-semibold text-gray-900 dark:text-gray-100 truncate">{treatment.doctorName}</p>
					</div>
					<div>
						<p class="text-gray-500 dark:text-gray-400">Data creării</p>
						<p class="font-semibold text-gray-900 dark:text-gray-100">{formatDate(treatment.createdAt)}</p>
					</div>
				</div>
			</div>

			<!-- Medications Section -->
			<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
				<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
					<h2 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">💊 Medicamente</h2>
					{#if $isMedic}
						<button
							onclick={() => showAddMedication = !showAddMedication}
							class="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition whitespace-nowrap"
						>
							+ Adaugă Medicament
						</button>
					{/if}
				</div>

				{#if showAddMedication && $isMedic}
					<div transition:fly={{ y: -20, duration: 300, easing: quintOut }} class="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700">
						<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
							{editingMedication ? 'Editează Medicament' : 'Adaugă Medicament Nou'}
						</h3>
						<form onsubmit={(e) => { e.preventDefault(); editingMedication ? handleUpdateMedication() : handleAddMedication(); }} class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label for="med-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nume Medicament *</label>
								<input
									id="med-name"
									type="text"
									bind:value={newMedication.medicationName}
									required
									class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
								/>
							</div>
							<div>
								<label for="med-dosage" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cantitate/Dozaj *</label>
								<input
									id="med-dosage"
									type="text"
									bind:value={newMedication.cantitate}
									placeholder="ex: 500mg"
									required
									class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
								/>
							</div>
							<div>
								<label for="med-time" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Oră Administrare *</label>
								<input
									id="med-time"
									type="time"
									bind:value={newMedication.ora}
									required
									class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
								/>
							</div>
							<div>
								<label for="med-frequency" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frecvență *</label>
								<select
									id="med-frequency"
									bind:value={newMedication.frecventa}
									class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
								>
									<option value="zilnic">Zilnic</option>
									<option value="de 2 ori pe zi">De 2 ori pe zi</option>
									<option value="de 3 ori pe zi">De 3 ori pe zi</option>
									<option value="saptamanal">Săptămânal</option>
								</select>
							</div>
							<div>
								<label for="med-start" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Start *</label>
								<input
									id="med-start"
									type="date"
									bind:value={newMedication.startDate}
									required
									class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
								/>
							</div>
							<div>
								<label for="med-end" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Sfârșit</label>
								<input
									id="med-end"
									type="date"
									bind:value={newMedication.endDate}
									class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
								/>
							</div>
							<div class="md:col-span-2">
								<label for="med-instructions" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instrucțiuni</label>
								<textarea
									id="med-instructions"
									bind:value={newMedication.instructiuni}
									rows="3"
									class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
								></textarea>
							</div>
							<div class="md:col-span-2 flex flex-col sm:flex-row gap-3">
								<button
									type="submit"
									class="w-full sm:flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
								>
									{editingMedication ? 'Actualizează' : 'Salvează Medicament'}
								</button>
								<button
									type="button"
									onclick={() => editingMedication ? cancelEdit() : showAddMedication = false}
									class="w-full sm:w-auto px-6 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 font-semibold rounded-lg transition"
								>
									Anulează
								</button>
							</div>
						</form>
					</div>
				{/if}

				{#if medications.length === 0}
					<div class="text-center py-12">
						<svg class="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
						</svg>
						<p class="text-gray-500 dark:text-gray-400">Niciun medicament adăugat încă</p>
					</div>
				{:else}
					<div class="space-y-4">
						{#each medications as med}
							<div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-600 transition">
								<div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
									<div class="flex-1 min-w-0">
										<h3 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 break-words">{med.medicationName}</h3>
										<p class="text-gray-600 dark:text-gray-400 text-sm mt-1">{med.quantity} • {med.frequency}</p>
										{#if med.instructions}
											<p class="text-gray-500 dark:text-gray-400 text-sm mt-2 break-words">{med.instructions}</p>
										{/if}
										{#if med.medicationDetails}
											<p class="text-gray-500 dark:text-gray-400 text-xs mt-1 break-words">{med.medicationDetails}</p>
										{/if}
									</div>
									<div class="flex sm:flex-col items-center sm:items-end gap-2 flex-shrink-0">
									<p class="text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{formatTime(med.time)}</p>
										<span class="inline-block px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap {med.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400'}">
										{med.isActive ? 'Activ' : 'Inactiv'}
										</span>
										{#if $isMedic}
											<button
												onclick={() => { startEditMedication(med); showAddMedication = true; }}
												class="px-3 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 text-xs font-medium rounded transition whitespace-nowrap"
											>
												✏️ Editează
											</button>
											<button
												onclick={() => handleDeleteMedication(med.doseId)}
												class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition whitespace-nowrap"
											>
												🗑 Șterge
											</button>
										{/if}
									</div>
								</div>
								<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
									<span class="whitespace-nowrap">📅 Start: {formatDate(med.startDate)}</span>
									{#if med.endDate}
										<span class="whitespace-nowrap">📅 Sfârșit: {formatDate(med.endDate)}</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</main>
{/if}
