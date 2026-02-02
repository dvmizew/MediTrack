<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { adminReportsApi } from '$lib/api/client';
	import { User } from '@lucide/svelte';
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
			error = 'ID utilizator lipsă';
			loading = false;
			return;
		}
		try {
			loading = true;
			report = await adminReportsApi.getUserReport(userId);
		} catch (e: any) {
			error = e?.message || 'Nu s-a putut încărca raportul utilizatorului.';
		} finally {
			loading = false;
		}
	});

	function fmtDate(value?: string | null) {
		if (!value) return 'N/A';
		const d = new Date(value);
		return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('ro-RO');
	}
</script>

<main class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
	<div class="space-y-1">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-slate-100"><User class="w-8 h-8 inline mr-2" /> Raport utilizator</h1>
		<p class="text-gray-600 dark:text-slate-400">ID: {userId}</p>
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
		<div class="grid gap-4 md:grid-cols-3">
			<div class="md:col-span-2 bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-xl p-5 space-y-3">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-slate-100">Profil</h2>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-800 dark:text-slate-200">
					<p><span class="font-semibold">Nume: </span>{report.user.full_name || 'N/A'}</p>
					<p><span class="font-semibold">Email: </span>{report.user.email}</p>
					<p><span class="font-semibold">Rol: </span>{report.user.role}</p>
					<p><span class="font-semibold">Status: </span>{report.user.is_active ? 'Activ' : 'Inactiv'}</p>
					<p><span class="font-semibold">Creat: </span>{fmtDate(report.user.created_at)}</p>
				</div>
			</div>
			<div class="bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-xl p-5 space-y-2">
				<h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300">Aderență</h3>
				<p class="text-sm text-gray-700 dark:text-slate-200">XP: {report.stats?.nivel_xp ?? 0}</p>
				<p class="text-sm text-gray-700 dark:text-slate-200">Streak curent: {report.stats?.current_streak ?? 0}</p>
				<p class="text-sm text-gray-700 dark:text-slate-200">Streak maxim: {report.stats?.longest_streak ?? 0}</p>
				<p class="text-sm text-gray-700 dark:text-slate-200">Badge: {report.stats?.current_badge ?? 'N/A'}</p>
			</div>
		</div>

		<div class="bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-xl p-5 space-y-3">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-slate-100">Planuri de tratament</h2>
			{#if report.treatments.length === 0}
				<p class="text-sm text-gray-700 dark:text-slate-300">Nu există planuri active.</p>
			{:else}
				<div class="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700">
					<table class="min-w-full text-sm">
						<thead class="bg-gray-50 dark:bg-slate-900/40 text-gray-600 dark:text-slate-300 uppercase tracking-wide text-xs">
							<tr>
								<th class="px-4 py-3 text-left">Plan</th>
								<th class="px-4 py-3 text-left">Status</th>
								<th class="px-4 py-3 text-right">Creat</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 dark:divide-gray-700 text-gray-800 dark:text-slate-200">
							{#each report.treatments as plan}
								<tr>
									<td class="px-4 py-2">{plan.diagnoza || 'N/A'}</td>
									<td class="px-4 py-2">{plan.activ ? 'Activ' : 'Inactiv'}</td>
									<td class="px-4 py-2 text-right">{fmtDate(plan.data_creare)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<div class="bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800/70 rounded-xl p-5 space-y-3">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-slate-100">Confirmări doze (ultimele 100)</h2>
			{#if report.confirmations.length === 0}
				<p class="text-sm text-gray-700 dark:text-slate-300">Nu există confirmări.</p>
			{:else}
				<div class="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700">
					<table class="min-w-full text-sm">
						<thead class="bg-gray-50 dark:bg-slate-900/40 text-gray-600 dark:text-slate-300 uppercase tracking-wide text-xs">
							<tr>
								<th class="px-4 py-3 text-left">Rezultat</th>
								<th class="px-4 py-3 text-left">Programat</th>
								<th class="px-4 py-3 text-left">Confirmat</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 dark:divide-gray-700 text-gray-800 dark:text-slate-200">
							{#each report.confirmations as c}
								<tr>
									<td class="px-4 py-2 capitalize">{c.rezultat}</td>
									<td class="px-4 py-2">{fmtDate(c.scheduled_for)}</td>
									<td class="px-4 py-2">{fmtDate(c.timestamp_confirmare)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</main>
