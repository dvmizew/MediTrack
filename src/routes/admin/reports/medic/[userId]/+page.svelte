<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { adminReportsApi } from '$lib/api/client';
	import { Stethoscope } from '@lucide/svelte';
	import { authStore } from '$lib/stores/auth';

	let report = $state<any | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let isAdmin = $derived($authStore.user?.role === 'admin');
	let userId = $derived($page.params.userId);

	onMount(async () => {
		if (!isAdmin) {
			goto('/dashboard');
			return;
		}
		if (!userId) {
			error = 'ID medic lipsă';
			loading = false;
			return;
		}
		try {
			loading = true;
			report = await adminReportsApi.getMedicReport(userId);
		} catch (e: any) {
			error = e?.message || 'Nu s-a putut încărca raportul medicului.';
		} finally {
			loading = false;
		}
	});
</script>

<main class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
	<div class="space-y-1">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100"><Stethoscope class="w-8 h-8 inline mr-2" /> Raport medic</h1>
		<p class="text-gray-700 dark:text-gray-300">ID: {userId}</p>
	</div>

	{#if loading}
		<div class="flex justify-center items-center py-16">
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
		</div>
	{:else if error}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg">
			{error}
		</div>
	{:else if report}
		<div class="grid gap-4 md:grid-cols-2">
			<div class="bg-white/90 dark:bg-gray-900/70 border border-slate-200/70 dark:border-gray-800/70 rounded-xl p-5 space-y-2">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Profil</h2>
				<p class="text-sm text-gray-700 dark:text-gray-200">Nume: {report.medic.full_name || 'N/A'}</p>
				<p class="text-sm text-gray-700 dark:text-gray-200">Email: {report.medic.email}</p>
				<p class="text-sm text-gray-700 dark:text-gray-200">Rol: {report.medic.role}</p>
			</div>
			<div class="bg-white/90 dark:bg-gray-900/70 border border-slate-200/70 dark:border-gray-800/70 rounded-xl p-5 space-y-2">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Indicatori</h2>
				<p class="text-sm text-gray-700 dark:text-gray-200">Pacienți: {report.patients}</p>
				<p class="text-sm text-gray-700 dark:text-gray-200">Planuri: {report.plans}</p>
				<p class="text-sm text-gray-700 dark:text-gray-200">Mesaje trimise: {report.messages}</p>
				<p class="text-sm text-gray-700 dark:text-gray-200">Rate acceptare invitații: {Math.round((report.invites.acceptanceRate || 0) * 100)}%</p>
			</div>
		</div>

		<div class="bg-white/90 dark:bg-gray-900/70 border border-slate-200/70 dark:border-gray-800/70 rounded-xl p-5 space-y-3">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Invitații</h2>
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-black dark:text-white">
				<div class="px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">Acceptate: {report.invites.accepted}</div>
				<div class="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">Respins: {report.invites.rejected}</div>
				<div class="px-3 py-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">În așteptare: {report.invites.pending}</div>
			</div>
		</div>
	{/if}
</main>
