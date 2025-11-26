<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore, isMedic, isPacient } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import Header from '$lib/components/Header.svelte';

	let treatments = $state<any[]>([]);
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		if (!$authStore.isAuthenticated) {
			goto('/');
			return;
		}
		await loadTreatments();
	});

	async function loadTreatments() {
		try {
			loading = true;
			error = '';
			const data = await api.getTreatments();
			treatments = data;
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
</script>

{#if $authStore.isAuthenticated}
	<div class="min-h-screen bg-gray-50 dark:bg-gray-900 animate-fade-in">
		<Header />
		<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<div class="mb-8">
				<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">📋 Planuri de Tratament</h1>
				<p class="text-gray-600 dark:text-gray-400">
					{#if $isMedic}
						Gestionează planurile de tratament pentru pacienții tăi
					{:else}
						Vezi și gestionează planurile tale de tratament
					{/if}
				</p>
			</div>

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
				<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-16 text-center animate-scale-in">
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
						<p class="text-gray-500 dark:text-gray-400">
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
					<div
						class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition cursor-pointer group"
						onclick={() => viewDetails(treatment.plan_id)}
						>
							<div class="flex justify-between items-start mb-4">
								<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
									{treatment.diagnoza}
								</h3>
								<span
									class="px-3 py-1 text-xs font-semibold rounded-full shadow-sm"
									class:bg-green-500={treatment.activ}
									class:text-white={treatment.activ}
									class:bg-gray-100={!treatment.activ}
									class:text-gray-600={!treatment.activ}
								>
									{treatment.activ ? '✓ Activ' : '⏸ Inactiv'}
								</span>
							</div>

							{#if treatment.descriere}
								<p class="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">{treatment.descriere}</p>
							{/if}

						<div class="space-y-2 text-sm mb-4">
							{#if $isMedic}
								<div class="flex items-center text-gray-600 dark:text-gray-400">
									<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
											/>
										</svg>
										<span>{treatment.patient_name}</span>
									</div>
							{:else}
								<div class="flex items-center text-gray-600 dark:text-gray-400">
										<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
											/>
										</svg>
										<span>Dr. {treatment.doctor_name}</span>
									</div>
								{/if}

								<div class="flex items-center text-gray-500 dark:text-gray-400">
									<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
										/>
									</svg>
									<span>{new Date(treatment.data_creare).toLocaleDateString('ro-RO')}</span>
								</div>
							</div>

						<div class="flex items-center justify-end pt-3 border-t border-gray-100 dark:border-gray-700">
							<span class="text-sm text-blue-600 dark:text-blue-400 font-medium group-hover:underline">Vezi detalii →</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</main>
	</div>
{/if}
