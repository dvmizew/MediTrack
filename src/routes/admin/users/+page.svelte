<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/notifications';

	let user = $derived($authStore.user);
	let isAdmin = $derived(user?.role === 'admin');

	let users = $state<any[]>([]);
	let filteredUsers = $state<any[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');
	let roleFilter = $state<'all' | 'admin' | 'medic' | 'pacient'>('all');

	onMount(async () => {
		if (!isAdmin) {
			goto('/dashboard');
			return;
		}
		await loadUsers();
	});

	$effect(() => {
		// Trigger re-filter when search or role filter changes
		const _unused = searchQuery;  // dependency
		const _unused2 = roleFilter;  // dependency
		applyFilters();
	});

	async function loadUsers() {
		try {
			loading = true;
			const data = await api.getUsers();
			users = data;
			applyFilters();
		} catch (err) {
			toastStore.add({
				type: 'error',
				title: 'Eroare',
				message: 'Nu s-au putut încărca utilizatorii',
				duration: 3000
			});
		} finally {
			loading = false;
		}
	}

	function applyFilters() {
		let result = users;

		if (roleFilter !== 'all') {
			result = result.filter(u => u.role === roleFilter);
		}

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter(u => 
				(u.fullName || '').toLowerCase().includes(query) ||
				(u.email || '').toLowerCase().includes(query)
			);
		}

		filteredUsers = result;
	}

	async function handleRoleChange(userId: number, newRole: string) {
		try {
			await api.updateUserRole(userId, newRole);
			toastStore.add({
				type: 'success',
				title: 'Succes',
				message: 'Rol actualizat',
				duration: 2000
			});
			await loadUsers();
		} catch (err) {
			toastStore.add({
				type: 'error',
				title: 'Eroare',
				message: 'Nu s-a putut actualiza rolul',
				duration: 3000
			});
		}
	}

	async function toggleUserStatus(userId: number, currentStatus: boolean) {
		try {
			await api.toggleUserStatus(userId);
			toastStore.add({
				type: 'success',
				title: 'Succes',
				message: currentStatus ? 'Utilizator dezactivat' : 'Utilizator activat',
				duration: 2000
			});
			await loadUsers();
		} catch (err) {
			toastStore.add({
				type: 'error',
				title: 'Eroare',
				message: 'Nu s-a putut schimba statusul',
				duration: 3000
			});
		}
	}

	function getRoleBadgeColor(role: string) {
		switch (role) {
			case 'admin': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400';
			case 'medic': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400';
			case 'pacient': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400';
			default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400';
		}
	}

	function getRoleIcon(role: string) {
		switch (role) {
			case 'admin': return '👑';
			case 'medic': return '👨‍⚕️';
			case 'pacient': return '🧑';
			default: return '👤';
		}
	}

	function formatDate(dateString: string | null | undefined, format: 'short' | 'long' = 'long'): string {
		if (!dateString) return 'N/A';
		try {
			const date = new Date(dateString);
			if (isNaN(date.getTime())) return 'Invalid date';
			
			if (format === 'short') {
				return date.toLocaleDateString('ro-RO', { month: 'short', day: 'numeric' });
			}
			return date.toLocaleDateString('ro-RO', {
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			});
		} catch (error) {
			return 'Invalid date';
		}
	}
</script>

<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">👥 Gestionare Utilizatori</h1>
		<p class="text-gray-600 dark:text-gray-400">Administrează rolurile și statusul utilizatorilor</p>
	</div>

	{#if loading}
		<div class="flex justify-center items-center py-20">
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
		</div>
	{:else}
		<!-- Filters -->
		<div class="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 mb-6">
			<div class="flex items-center gap-2 mb-4">
				<span class="text-xl">🔍</span>
				<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Filtrare și Căutare</h2>
			</div>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div>
					<label for="search" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Caută utilizator
					</label>
					<input
						id="search"
						type="text"
						bind:value={searchQuery}
						placeholder="Nume sau email..."
						class="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 transition"
					/>
				</div>
				<div>
					<label for="roleFilter" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Filtrează după rol
					</label>
					<select
						id="roleFilter"
						bind:value={roleFilter}
						class="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 transition"
					>
						<option value="all">Toți utilizatorii</option>
						<option value="admin">Administratori</option>
						<option value="medic">Medici</option>
						<option value="pacient">Pacienți</option>
					</select>
				</div>
				<div class="flex flex-col justify-end">
					<div class="px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
						<p class="text-sm font-medium text-blue-900 dark:text-blue-400">
							{filteredUsers.length} / {users.length} utilizatori
						</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Users List -->
		{#if filteredUsers.length === 0}
			<div class="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-16 text-center">
				<div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
					<svg class="h-8 w-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
					</svg>
				</div>
				<p class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Niciun utilizator găsit</p>
				<p class="text-gray-500 dark:text-gray-400">Încearcă să schimbi criteriile de căutare</p>
			</div>
		{:else}
			<div class="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="hidden md:block overflow-x-auto">
					<table class="w-full">
						<thead class="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-800/50 border-b border-gray-200 dark:border-gray-700">
							<tr>
								<th class="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
									👤 Utilizator
								</th>
								<th class="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
									🎯 Rol
								</th>
								<th class="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
									⚡ Status
								</th>
								<th class="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
									📅 Data Creării
								</th>
								<th class="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
									⚙️ Acțiuni
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
							{#each filteredUsers as u}
								<tr class="hover:bg-blue-50/50 dark:hover:bg-gray-700/30 transition duration-150">
									<td class="px-6 py-4">
										<div class="flex items-center gap-3">
											<div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md">
												{(u.fullName || 'U').charAt(0).toUpperCase()}
											</div>
											<div class="min-w-0">
												<p class="font-semibold text-gray-900 dark:text-gray-100 truncate">{u.fullName || 'Unknown'}</p>
												<p class="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email || 'N/A'}</p>
											</div>
										</div>
									</td>
									<td class="px-6 py-4">
										<span class="px-3 py-1 rounded-full text-xs font-semibold {getRoleBadgeColor(u.role)}">
											{getRoleIcon(u.role)} {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
										</span>
									</td>
									<td class="px-6 py-4">
										<span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold {u.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'}">
											<span class="w-2 h-2 rounded-full {u.isActive ? 'bg-green-500' : 'bg-red-500'} animate-pulse"></span>
											{u.isActive ? 'Activ' : 'Inactiv'}
										</span>
									</td>
									<td class="px-6 py-4">
										<p class="text-sm text-gray-600 dark:text-gray-400">
											{formatDate(u.createdAt)}
										</p>
									</td>
									<td class="px-6 py-4 text-right">
										<div class="flex items-center justify-end gap-2">
											<button
												onclick={() => toggleUserStatus(u.userId, u.isActive)}
												disabled={u.userId === user?.userId}
												class="px-4 py-2 {u.isActive ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40'} text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap border {u.isActive ? 'border-red-200 dark:border-red-800' : 'border-green-200 dark:border-green-800'}"
												title={u.userId === user?.userId ? 'Nu puteți modifica propriul account' : ''}
											>
												{u.isActive ? '🚫 Dezactivează' : '✅ Activează'}
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Mobile Card Layout -->
				<div class="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
					{#each filteredUsers as u}
						<div class="p-5 space-y-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
							<!-- Header with name and status -->
							<div class="flex items-start justify-between gap-3">
								<div class="flex items-center gap-3 flex-1 min-w-0">
									<div class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0 shadow-md">
										{(u.fullName || 'U').charAt(0).toUpperCase()}
									</div>
									<div class="flex-1 min-w-0">
										<p class="font-semibold text-gray-900 dark:text-gray-100 truncate text-sm">{u.fullName || 'Unknown'}</p>
										<p class="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email || 'N/A'}</p>
									</div>
								</div>
								<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold flex-shrink-0 {u.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'}">
									<span class="w-1.5 h-1.5 rounded-full {u.isActive ? 'bg-green-500' : 'bg-red-500'} animate-pulse"></span>
									<span>{u.isActive ? 'Activ' : 'Inactiv'}</span>
								</span>
							</div>

							<!-- Role and Date -->
							<div class="grid grid-cols-2 gap-3">
								<div>
									<p class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Rol</p>
									<span class="px-2.5 py-1 rounded-full text-xs font-semibold {getRoleBadgeColor(u.role)} inline-block">
										{getRoleIcon(u.role)} {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
									</span>
								</div>
								<div>
									<p class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Creat</p>
									<p class="text-xs text-gray-700 dark:text-gray-300">
										{formatDate(u.createdAt, 'short')}
									</p>
								</div>
							</div>

							<!-- Actions -->
							<div class="flex gap-2 pt-2">
								<button
									onclick={() => toggleUserStatus(u.userId, u.isActive)}
									disabled={u.userId === user?.userId}
									class="flex-1 px-3 py-2.5 {u.isActive ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/40'} text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
									title={u.userId === user?.userId ? 'Nu puteți modifica propriul account' : ''}
								>
									{u.isActive ? '🚫 Dezactivează' : '✅ Activează'}
								</button>
								<select
									value={u.role}
									onchange={(e) => handleRoleChange(u.userId, e.currentTarget.value)}
									disabled={u.userId === user?.userId}
									class="px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition"
									title={u.userId === user?.userId ? 'Nu puteți modifica propriul rol' : ''}
								>
									<option value="admin">👑</option>
									<option value="medic">👨‍⚕️</option>
									<option value="pacient">🧑</option>
								</select>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</main>
