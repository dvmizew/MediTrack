<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { authStore, isMedic } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import { ArrowLeft, CalendarDays, Pencil, Pill, Plus, Trash2 } from '@lucide/svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Card from '$lib/components/Card.svelte';

	const planIdParam = $derived($page.params.planId ?? '0');
	let planId = $derived(parseInt(planIdParam, 10));
	let treatment = $state<any>(null);
	let medications = $state<any[]>([]);
	let loading = $state(true);
	let error = $state('');
	let editingMedication = $state<any>(null);
	
	// Modale pentru editare și adăugare
	let showEditTreatmentModal = $state(false);
	let showEditMedicationModal = $state(false);
	let showAddMedicationModal = $state(false);

	function closeAllModals() {
		showEditTreatmentModal = false;
		showEditMedicationModal = false;
		showAddMedicationModal = false;
	}
	
	// Modal state
	let modalState = $state({
		isOpen: false,
		title: '',
		content: '',
		type: 'info' as 'info' | 'warning' | 'error' | 'success',
		showCancel: false,
		confirmText: 'OK',
		cancelText: 'Anulează',
		onConfirm: undefined as (() => void | Promise<void>) | undefined,
		onCancel: undefined as (() => void) | undefined
	});

	let treatmentForm = $state({
		diagnostic: '',
		descriere: ''
	});

	let deleteConfirmToken = $state<string | null>(null);

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

	function isPastTimeForToday(dateValue: string, timeValue: string) {
		if (!dateValue || !timeValue) return false;
		const today = new Date();
		const selectedDate = new Date(dateValue);
		if (Number.isNaN(selectedDate.getTime())) return false;
		const isToday =
			selectedDate.getFullYear() === today.getFullYear() &&
			selectedDate.getMonth() === today.getMonth() &&
			selectedDate.getDate() === today.getDate();
		if (!isToday) return false;
		const [hours, minutes] = timeValue.split(':').map(Number);
		if (Number.isNaN(hours) || Number.isNaN(minutes)) return false;
		const selectedTime = new Date(today);
		selectedTime.setHours(hours, minutes, 0, 0);
		return selectedTime.getTime() < today.getTime();
	}

	function showModal(options: {
		title: string;
		content: string;
		type?: 'info' | 'warning' | 'error' | 'success';
		showCancel?: boolean;
		confirmText?: string;
		cancelText?: string;
		onConfirm?: (() => void | Promise<void>) | undefined;
		onCancel?: (() => void) | undefined;
	}) {
		modalState.isOpen = true;
		modalState.title = options.title;
		modalState.content = options.content;
		modalState.type = options.type || 'info';
		modalState.showCancel = options.showCancel || false;
		modalState.confirmText = options.confirmText || 'OK';
		modalState.cancelText = options.cancelText || 'Anulează';
		modalState.onConfirm = options.onConfirm;
		modalState.onCancel = options.onCancel;
	}

	function closeModal() {
		modalState.isOpen = false;
		modalState.onConfirm = undefined;
		modalState.onCancel = undefined;
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

	function resetDeleteState() {
		deleteConfirmToken = null;
	}

	async function startTreatmentDelete() {
		try {
			const response = await api.deleteTreatment(planId);
			deleteConfirmToken = response.confirmToken;
			showModal({
				title: 'Confirmare ștergere',
				content: 'Sigur vrei să ștergi planul de tratament? Acțiunea este permanentă.',
				type: 'warning',
				showCancel: true,
				confirmText: 'Șterge',
				cancelText: 'Anulează',
				onConfirm: confirmTreatmentDelete
			});
		} catch (err: any) {
			resetDeleteState();
			showModal({
				title: 'Eroare',
				content: 'Nu s-a putut iniția ștergerea',
				type: 'error'
			});
		}
	}

	async function confirmTreatmentDelete() {
		if (!deleteConfirmToken) return;
		try {
			await api.deleteTreatment(planId, deleteConfirmToken);
			resetDeleteState();
			closeModal();
			showModal({
				title: 'Succes',
				content: 'Planul de tratament a fost șters cu succes.',
				type: 'success',
				onConfirm: () => goto('/treatments')
			});
		} catch (err: any) {
			showModal({
				title: 'Eroare',
				content: 'Nu s-a putut șterge planul',
				type: 'error'
			});
			resetDeleteState();
		}
	}

	async function handleAddMedication() {
		if ($isMedic && isPastTimeForToday(newMedication.startDate, newMedication.ora)) {
			showModal({
				title: 'Oră invalidă',
				content: 'Nu poți adăuga o doză la o oră care a trecut deja pentru ziua de azi.',
				type: 'warning'
			});
			return;
		}
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

			showAddMedicationModal = false;
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
			
			showModal({
				title: 'Succes',
				content: 'Medicament adăugat cu succes',
				type: 'success'
			});

			await loadTreatmentDetails();
		} catch (err: any) {
			console.error('Failed to add medication:', err);
			showModal({
				title: 'Eroare',
				content: 'Nu s-a putut adăuga medicamentul',
				type: 'error'
			});
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
		newMedication.detaliiMedicament = med.detaliiMedicament || med.medicationDetails || '';
		showEditMedicationModal = true;
	}

	async function handleUpdateMedication() {
		if (!editingMedication) return;
		if ($isMedic && isPastTimeForToday(newMedication.startDate, newMedication.ora)) {
			showModal({
				title: 'Oră invalidă',
				content: 'Nu poți seta o doză la o oră care a trecut deja pentru ziua de azi.',
				type: 'warning'
			});
			return;
		}

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

			showEditMedicationModal = false;
			editingMedication = null;
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
			showModal({
				title: 'Succes',
				content: 'Medicament actualizat',
				type: 'success'
			});
			await loadTreatmentDetails();
		} catch (err) {
			showModal({
				title: 'Eroare',
				content: 'Eroare la actualizarea medicamentului',
				type: 'error'
			});
		}
	}

	async function handleDeleteMedication(doseId: number) {
		showModal({
			title: 'Confirmă ștergere',
			content: 'Sigur vrei să ștergi acest medicament? Această acțiune nu poate fi anulată.',
			type: 'warning',
			showCancel: true,
			confirmText: 'Șterge',
			cancelText: 'Anulează',
			onConfirm: async () => {
				try {
					await api.deleteMedication(doseId);
					closeModal();
					showModal({
						title: 'Succes',
						content: 'Medicament șters cu succes',
						type: 'success'
					});
					await loadTreatmentDetails();
				} catch (err: any) {
					closeModal();
					showModal({
						title: 'Eroare',
						content: 'Nu s-a putut șterge medicamentul',
						type: 'error'
					});
				}
			}
		});
	}

	function startEditTreatment() {
		treatmentForm.diagnostic = treatment.diagnosis;
		treatmentForm.descriere = treatment.description || '';
		showEditTreatmentModal = true;
	}


	async function handleUpdateTreatment() {
		try {
			await api.updateTreatment(planId, {
				diagnosis: treatmentForm.diagnostic,
				description: treatmentForm.descriere
			});

			showEditTreatmentModal = false;
			treatmentForm.diagnostic = '';
			treatmentForm.descriere = '';
			showModal({
				title: 'Succes',
				content: 'Tratament actualizat',
				type: 'success'
			});
			await loadTreatmentDetails();
		} catch (err) {
			showModal({
				title: 'Eroare',
				content: 'Eroare la actualizarea tratamentului',
				type: 'error'
			});
		}
	}
</script>

{#if $authStore.isAuthenticated}
	<main class="page-transition max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<div class="mb-6">
			<button
				onclick={() => goto('/treatments')}
				class="flex items-center gap-2 text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition"
			>
				<ArrowLeft class="w-5 h-5" />
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
			<Card renderCustom unstyled containerClass="mb-6">
				<div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
					<div class="flex-1 min-w-0">
						<h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2 break-words">{treatment.diagnosis}</h1>
						<p class="text-gray-700 dark:text-slate-300 break-words">{treatment.description || 'Fără descriere'}</p>
					</div>
					<div class="flex items-center gap-3 flex-shrink-0">
								<span class="px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-full whitespace-nowrap {treatment.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-slate-100'}">
							{treatment.isActive ? 'Activ' : 'Inactiv'}
						</span>
						{#if $isMedic}
							{#if deleteConfirmToken}
								<div class="flex items-center gap-2">
									<button
										onclick={confirmTreatmentDelete}
										class="px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition whitespace-nowrap"
									>
										Confirmă ștergerea
									</button>
									<button
										onclick={resetDeleteState}
										class="px-3 sm:px-4 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-slate-100 text-xs sm:text-sm font-medium rounded-lg transition whitespace-nowrap"
									>
										Anulează
									</button>
								</div>
							{:else}
								<button
									onclick={startEditTreatment}
									class="px-3 sm:px-4 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-slate-100 text-xs sm:text-sm font-medium rounded-lg transition whitespace-nowrap inline-flex items-center gap-2"
								>
									<Pencil class="w-4 h-4" />
									Editează
								</button>
								<button
									onclick={startTreatmentDelete}
									class="px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition whitespace-nowrap inline-flex items-center gap-2"
								>
									<Trash2 class="w-4 h-4" />
									Șterge
								</button>
							{/if}
						{/if}
					</div>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
					<div>
						<p class="text-gray-700 dark:text-slate-300">Pacient</p>
						<p class="font-semibold text-gray-900 dark:text-slate-100 truncate">{treatment.patientName}</p>
					</div>
					<div>
						<p class="text-gray-700 dark:text-slate-300">Medic</p>
						<p class="font-semibold text-gray-900 dark:text-slate-100 truncate">{treatment.doctorName}</p>
					</div>
					<div>
						<p class="text-gray-700 dark:text-slate-300">Data creării</p>
						<p class="font-semibold text-gray-900 dark:text-slate-100">{formatDate(treatment.createdAt)}</p>
					</div>
				</div>
			</Card>

			<!-- Medications Section -->
			<Card renderCustom unstyled containerClass="">
				<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
					<h2 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
						<Pill class="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
						Medicamente
					</h2>
					{#if $isMedic}
						<button
							onclick={() => showAddMedicationModal = true}
							class="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition whitespace-nowrap inline-flex items-center gap-2"
						>
							<Plus class="w-4 h-4" />
							Adaugă Medicament
						</button>
					{/if}
				</div>

				{#if medications.length === 0}
					<div class="text-center py-12">
						<Pill class="mx-auto h-16 w-16 text-gray-300 dark:text-slate-600 mb-4" />
						<p class="text-gray-700 dark:text-slate-300">Niciun medicament adăugat încă</p>
					</div>
				{:else}
					<div class="space-y-4">
						{#each medications as med}
							<div class="border border-gray-200 dark:border-slate-700 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-600 transition">
								<div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
									<div class="flex-1 min-w-0">
										<h3 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 break-words">{med.medicationName}</h3>
										<p class="text-gray-700 dark:text-slate-300 text-sm mt-1">{med.quantity} • {med.frequency}</p>
										{#if med.instructions}
											<p class="text-gray-700 dark:text-slate-300 text-sm mt-2 break-words">{med.instructions}</p>
										{/if}
										{#if med.medicationDetails}
											<p class="text-gray-700 dark:text-slate-300 text-xs mt-1 break-words">{med.medicationDetails}</p>
										{/if}
									</div>
									<div class="flex sm:flex-col items-center sm:items-end gap-2 flex-shrink-0">
									<p class="text-sm font-medium text-gray-900 dark:text-slate-100 whitespace-nowrap">{formatTime(med.time)}</p>
										<span class="inline-block px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap {med.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-slate-100'}">
										{med.isActive ? 'Activ' : 'Inactiv'}
										</span>
										{#if $isMedic}
											<button
												onclick={() => startEditMedication(med)}
												class="px-3 py-1 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-slate-100 text-xs font-medium rounded transition whitespace-nowrap inline-flex items-center gap-2"
											>
												<Pencil class="w-3.5 h-3.5" />
												Editează
											</button>
											<button
												onclick={() => handleDeleteMedication(med.doseId)}
												class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition whitespace-nowrap inline-flex items-center gap-2"
											>
												<Trash2 class="w-3.5 h-3.5" />
												Șterge
											</button>
										{/if}
									</div>
								</div>
								<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700 dark:text-slate-300">
									<span class="whitespace-nowrap inline-flex items-center gap-1">
										<CalendarDays class="w-3.5 h-3.5" />
										Start: {formatDate(med.startDate)}
									</span>
									{#if med.endDate}
										<span class="whitespace-nowrap inline-flex items-center gap-1">
											<CalendarDays class="w-3.5 h-3.5" />
											Sfârșit: {formatDate(med.endDate)}
										</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</Card>
		{/if}
	</main>
{/if}

<Modal
	isOpen={modalState.isOpen}
	title={modalState.title}
	content={modalState.content}
	type={modalState.type}
	showCancel={modalState.showCancel}
	confirmText={modalState.confirmText}
	cancelText={modalState.cancelText}
	onConfirm={modalState.onConfirm}
	onCancel={modalState.onCancel}
	onClose={closeModal}
/>

<!-- Modal Editare Tratament -->
<Modal
	isOpen={showEditTreatmentModal}
	title="Editează Tratament"
	size="md"
	onClose={() => showEditTreatmentModal = false}
	confirmText="Salvează"
	showCancel={true}
	onConfirm={handleUpdateTreatment}
	onCancel={() => showEditTreatmentModal = false}
>
	<div class="space-y-4">
		<div>
			<label for="edit-diagnostic" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
				Diagnostic *
			</label>
			<input
				id="edit-diagnostic"
				type="text"
				bind:value={treatmentForm.diagnostic}
				required
				class="w-full px-4 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100"
			/>
		</div>
		<div>
			<label for="edit-descriere" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
				Descriere
			</label>
			<textarea
				id="edit-descriere"
				bind:value={treatmentForm.descriere}
				rows="4"
				class="w-full px-4 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100 resize-none"
			></textarea>
		</div>
	</div>
</Modal>

<!-- Modal Editare Medicament -->
<Modal
	isOpen={showEditMedicationModal}
	title="Editează Medicament"
	size="xl"
	onClose={() => showEditMedicationModal = false}
	confirmText="Actualizează"
	showCancel={true}
	onConfirm={handleUpdateMedication}
	onCancel={() => showEditMedicationModal = false}
>
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<div>
			<label for="med-name" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nume Medicament *</label>
			<input
				id="med-name"
				type="text"
				bind:value={newMedication.medicationName}
				required
				class="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
			/>
		</div>
		<div>
			<label for="med-quantity" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Cantitate *</label>
			<input
				id="med-quantity"
				type="text"
				bind:value={newMedication.cantitate}
				required
				class="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
			/>
		</div>
		<div>
			<label for="med-time" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Oră Administrare *</label>
			<input
				id="med-time"
				type="time"
				bind:value={newMedication.ora}
				required
				class="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
			/>
		</div>
		<div>
			<label for="med-frequency" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Frecvență *</label>
			<select
				id="med-frequency"
				bind:value={newMedication.frecventa}
				class="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
			>
				<option value="zilnic">Zilnic</option>
				<option value="de 2 ori pe zi">De 2 ori pe zi</option>
				<option value="de 3 ori pe zi">De 3 ori pe zi</option>
				<option value="saptamanal">Săptămânal</option>
			</select>
		</div>
		<div>
			<label for="med-start" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Data Start *</label>
			<input
				id="med-start"
				type="date"
				bind:value={newMedication.startDate}
				required
				class="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
			/>
		</div>
		<div>
			<label for="med-end" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Data Sfârșit</label>
			<input
				id="med-end"
				type="date"
				bind:value={newMedication.endDate}
				class="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
			/>
		</div>
		<div class="md:col-span-2">
			<label for="med-instructions" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Instrucțiuni</label>
			<textarea
				id="med-instructions"
				bind:value={newMedication.instructiuni}
				rows="3"
				class="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 resize-none focus:ring-2 focus:ring-blue-500"
			></textarea>
		</div>
	</div>
</Modal>

<!-- Modal Adăugare Medicament -->
<Modal
	isOpen={showAddMedicationModal}
	title="Adaugă Medicament"
	size="xl"
	onClose={() => showAddMedicationModal = false}
	confirmText="Adaugă Medicament"
	showCancel={true}
	onConfirm={handleAddMedication}
	onCancel={() => showAddMedicationModal = false}
>
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<div>
			<label for="add-med-name" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nume Medicament *</label>
			<input
				id="add-med-name"
				type="text"
				bind:value={newMedication.medicationName}
				required
				class="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
			/>
		</div>
		<div>
			<label for="add-med-quantity" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Cantitate *</label>
			<input
				id="add-med-quantity"
				type="text"
				bind:value={newMedication.cantitate}
				placeholder="ex: 500mg"
				required
				class="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
			/>
		</div>
		<div>
			<label for="add-med-time" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Oră Administrare *</label>
			<input
				id="add-med-time"
				type="time"
				bind:value={newMedication.ora}
				required
				class="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
			/>
		</div>
		<div>
			<label for="add-med-frequency" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Frecvență *</label>
			<select
				id="add-med-frequency"
				bind:value={newMedication.frecventa}
				class="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
			>
				<option value="zilnic">Zilnic</option>
				<option value="de 2 ori pe zi">De 2 ori pe zi</option>
				<option value="de 3 ori pe zi">De 3 ori pe zi</option>
				<option value="saptamanal">Săptămânal</option>
			</select>
		</div>
		<div>
			<label for="add-med-start" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Data Start *</label>
			<input
				id="add-med-start"
				type="date"
				bind:value={newMedication.startDate}
				required
				class="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
			/>
		</div>
		<div>
			<label for="add-med-end" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Data Sfârșit</label>
			<input
				id="add-med-end"
				type="date"
				bind:value={newMedication.endDate}
				class="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
			/>
		</div>
		<div class="md:col-span-2">
			<label for="add-med-instructions" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Instrucțiuni</label>
			<textarea
				id="add-med-instructions"
				bind:value={newMedication.instructiuni}
				rows="3"
				class="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 resize-none focus:ring-2 focus:ring-blue-500"
			></textarea>
		</div>
	</div>
</Modal>