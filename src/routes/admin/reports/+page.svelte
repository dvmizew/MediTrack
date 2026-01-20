<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { adminReportsApi } from '$lib/api/client';
	import { authStore } from '$lib/stores/auth';

	let overview = $state<any | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let isAdmin = $derived($authStore.user?.role === 'admin');

	onMount(async () => {
		if (!isAdmin) {
			goto('/dashboard');
			return;
		}
		try {
			loading = true;
			overview = await adminReportsApi.getOverview();
		} catch (e: any) {
			error = e?.message || 'Nu s-au putut încărca rapoartele.';
		} finally {
			loading = false;
		}
	});

	function formatPercent(value: number) {
		return `${Math.round((value || 0) * 100)}%`;
	}
</script>

<main class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
	<div class="space-y-1">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">📊 Rapoarte Admin</h1>
		<p class="text-gray-600 dark:text-gray-400">Overview utilizatori, colaborări și aderență.</p>
	</div>

	{#if loading}
		<div class="flex justify-center items-center py-16">
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
		</div>
	{:else if error}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg">
			{error}
		</div>
	{:else if overview}
		<div class="grid gap-4 md:grid-cols-2">
			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-3">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Utilizatori</h2>
				<div class="flex flex-wrap gap-3 text-sm">
					<span class="px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800">Activ: {overview.users.active}</span>
					<span class="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800">Inactiv: {overview.users.inactive}</span>
				</div>
				<div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
					<table class="min-w-full text-sm">
						<thead class="bg-gray-50 dark:bg-gray-900/40 text-gray-600 dark:text-gray-300 uppercase tracking-wide text-xs">
							<tr>
								<th class="px-4 py-3 text-left">Rol</th>
								<th class="px-4 py-3 text-right">Număr</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 dark:divide-gray-700 text-gray-800 dark:text-gray-200">
							{#each overview.users.byRole as row}
								<tr>
									<td class="px-4 py-2 capitalize">{row.role}</td>
									<td class="px-4 py-2 text-right font-semibold">{row.count}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-3">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Colaborări</h2>
				<div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
					<table class="min-w-full text-sm">
						<thead class="bg-gray-50 dark:bg-gray-900/40 text-gray-600 dark:text-gray-300 uppercase tracking-wide text-xs">
							<tr>
								<th class="px-4 py-3 text-left">Status</th>
								<th class="px-4 py-3 text-right">Număr</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 dark:divide-gray-700 text-gray-800 dark:text-gray-200">
							{#each overview.collaborations as row}
								<tr>
									<td class="px-4 py-2 capitalize">{row.status}</td>
									<td class="px-4 py-2 text-right font-semibold">{row.count}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>

		<div class="grid gap-4 md:grid-cols-3">
			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-2">
				<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Planuri tratament</h3>
				<p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{overview.treatments.total}</p>
				<p class="text-sm text-gray-600 dark:text-gray-400">Active: {overview.treatments.active} · Inactive: {overview.treatments.inactive}</p>
			</div>
			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-2">
				<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Doze programate</h3>
				<p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{overview.doses.total}</p>
				<p class="text-sm text-gray-600 dark:text-gray-400">Total în sistem (active)</p>
			</div>
			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-2">
				<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Aderență 7 zile</h3>
				<p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatPercent(overview.adherence.last7Days.rate)}</p>
				<p class="text-sm text-gray-600 dark:text-gray-400">{overview.adherence.last7Days.confirmed} confirmate / {overview.adherence.last7Days.scheduled} programate</p>
			</div>
		</div>

		<div class="grid gap-4 md:grid-cols-2">
			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-2">
				<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Aderență 30 zile</h3>
				<p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatPercent(overview.adherence.last30Days.rate)}</p>
				<p class="text-sm text-gray-600 dark:text-gray-400">{overview.adherence.last30Days.confirmed} confirmate / {overview.adherence.last30Days.scheduled} programate</p>
			</div>
			<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-2">
				<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Note</h3>
				<p class="text-sm text-gray-700 dark:text-gray-200">Datele provin din API-ul /admin/reports/overview și se actualizează la refresh.</p>
			</div>
		</div>
	{/if}
</main>
