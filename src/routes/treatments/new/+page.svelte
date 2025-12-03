<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';
	import { authStore } from '$lib/stores/auth';
	import { toastStore } from '$lib/stores/notifications';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	let user = $derived($authStore.user);
	let isMedic = $derived(user?.role === 'medic');

	let collaborations = $state<any[]>([]);
	let loading = $state(true);
	
	let formData = $state({
		patientId: '',
		diagnostic: '',
		descriere: ''
	});

	$effect(() => {
		if (!isMedic) {
			goto('/treatments');
		} else {
			loadCollaborations();
		}
	});

	async function loadCollaborations() {
		try {
			const data = await api.getMyCollaborations();
			collaborations = data.filter((c: any) => c.status === 'accepted');
			loading = false;
		} catch (err) {
			toastStore.add({
				type: 'error',
				title: 'Eroare',
				message: 'Nu s-au putut încărca pacienții',
				duration: 3000
			});
			loading = false;
		}
	}

	async function handleSubmit() {
		if (!formData.patientId || !formData.diagnostic.trim()) {
			toastStore.add({
				type: 'error',
				title: 'Eroare',
				message: 'Completează câmpurile obligatorii',
				duration: 3000
			});
			return;
		}

		try {
			const result = await api.createTreatment({
				patientId: parseInt(formData.patientId),
				diagnostic: formData.diagnostic,
				descriere: formData.descriere || undefined
			});

			toastStore.add({
				type: 'success',
				title: 'Succes',
				message: 'Tratament creat cu succes',
				duration: 2000
			});

			goto(`/treatments/${result.planId}`);
		} catch (err: any) {
			toastStore.add({
				type: 'error',
				title: 'Eroare',
				message: err.message || 'Nu s-a putut crea tratamentul',
				duration: 3000
			});
		}
	}
</script>

<main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<div class="mb-6">
		<button
			onclick={() => goto('/treatments')}
			class="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition"
		>
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
			</svg>
			Înapoi la Tratamente
		</button>
	</div>

	<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">📋 Tratament Nou</h1>
		<p class="text-gray-600 dark:text-gray-400 mb-8">Creează un plan de tratament pentru pacient</p>

		{#if loading}
			<div class="flex justify-center items-center py-12">
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
			</div>
		{:else}
			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-6">
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
							<option value={collab.patient_id}>
								{collab.patient_name}
							</option>
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
						rows="5"
						placeholder="Descrierea completă a tratamentului, recomandări, observații..."
						class="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 resize-none"
					></textarea>
				</div>

				<div class="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
					<button
						type="submit"
						class="w-full sm:flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={!formData.patientId || !formData.diagnostic.trim()}
					>
						Creează Tratament
					</button>
					<button
						type="button"
						onclick={() => goto('/treatments')}
						class="w-full sm:w-auto px-6 py-3 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 font-semibold rounded-lg transition"
					>
						Anulează
					</button>
				</div>
			</form>
		{/if}
	</div>
</main>
