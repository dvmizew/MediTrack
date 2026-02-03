<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import { api, adminReportsApi } from '$lib/api/client';
	import { toast } from '$lib/utils/toast';
	import { downloadBlobAsFile } from '$lib/utils/charts';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Card from '$lib/components/Card.svelte';
	import {
		Ban,
		CalendarDays,
		CheckCircle2,
		Crown,
		Download,
		LoaderCircle,
		Pencil,
		Plus,
		Search,
		Settings,
		Stethoscope,
		Target,
		Trash2,
		User,
		Users,
		Zap
	} from '@lucide/svelte';

	let user = $derived($authStore.user);
	let isAdmin = $derived(user?.role === 'admin');

	let users = $state<any[]>([]);
	let filteredUsers = $state<any[]>([]);
	let loading = $state(true);
	let exporting = $state(false);
	let searchQuery = $state('');
	let roleFilter = $state<'all' | 'admin' | 'medic' | 'pacient'>('all');
	
	// Form modal state
	let formModalOpen = $state(false);
	let formMode = $state<'add' | 'edit'>('add');
	let formLoading = $state(false);
	let selectedUserForEdit = $state<any>(null);

	// Form data
	let formData = $state({
		email: '',
		fullName: '',
		role: 'pacient' as 'admin' | 'medic' | 'pacient',
		password: ''
	});

	let formErrors = $state<Record<string, string>>({});
	
	// Modal state
	let confirmDialog = $state({
		isOpen: false,
		title: '',
		message: '',
		isDangerous: false,
		onConfirm: (() => {}) as () => void | Promise<void>,
		onCancel: (() => {}) as () => void
	});

	onMount(async () => {
		if (!isAdmin) {
			goto('/dashboard');
			return;
		}
		await loadUsers();
	});

	$effect(() => {
		// Re-filter when search or role filter changes
		searchQuery;  // dependency tracking
		roleFilter;   // dependency tracking
		applyFilters();
	});

	async function loadUsers() {
		try {
			loading = true;
			const data = await api.getUsers();
			users = data;
			applyFilters();
		} catch (err) {
			console.error('Nu s-au putut încărca utilizatorii', err);
		toast.error('Nu s-au putut încărca utilizatorii');
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
		const targetUser = users.find(u => u.userId === userId);
		if (!targetUser) return;
		
		const oldRole = targetUser.role;
		const userName = targetUser.fullName || targetUser.email || 'Utilizator';
		
		confirmDialog.isOpen = true;
		confirmDialog.title = 'Confirmă schimbarea rolului';
		confirmDialog.message = `Sigur vrei să schimbi rolul utilizatorului "${userName}" din ${oldRole} în ${newRole}?`;
		confirmDialog.isDangerous = newRole === 'admin';
		confirmDialog.onConfirm = async () => {
			try {
				await api.updateUserRole(userId, newRole);
			toast.success('Rol actualizat');
			await loadUsers();
		} catch (err) {
			console.error('Nu s-a putut actualiza rolul', err);
			toast.error('Nu s-a putut actualiza rolul');
			} finally {
				confirmDialog.isOpen = false;
			}
		};
		confirmDialog.onCancel = () => {
			confirmDialog.isOpen = false;
			// Reset the select to old value by reloading
			loadUsers();
		};
	}

	async function toggleUserStatus(userId: number, currentStatus: boolean) {
		const targetUser = users.find(u => u.userId === userId);
		if (!targetUser) return;
		
		const userName = targetUser.fullName || targetUser.email || 'Utilizator';
		const action = currentStatus ? 'dezactivezi' : 'activezi';
		const actionPast = currentStatus ? 'dezactivat' : 'activat';
		
		confirmDialog.isOpen = true;
		confirmDialog.title = `Confirmă ${currentStatus ? 'dezactivarea' : 'activarea'}`;
		confirmDialog.message = `Sigur vrei să ${action} utilizatorul "${userName}"?`;
		confirmDialog.isDangerous = currentStatus; // dangerous when deactivating
		confirmDialog.onConfirm = async () => {
			try {
				await api.toggleUserStatus(userId);
			toast.success(`Utilizator ${actionPast}`);
			await loadUsers();
		} catch (err) {
			console.error('Nu s-a putut schimba statusul', err);
			toast.error('Nu s-a putut schimba statusul');
			} finally {
				confirmDialog.isOpen = false;
			}
		};
		confirmDialog.onCancel = () => {
			confirmDialog.isOpen = false;
		};
	}

	function getRoleBadgeColor(role: string) {
		switch (role) {
			case 'admin': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400';
			case 'medic': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400';
			case 'pacient': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400';
				default: return 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-slate-100';
		}
	}

	function getRoleIconComponent(role: string) {
		switch (role) {
			case 'admin': return Crown;
			case 'medic': return Stethoscope;
			case 'pacient': return User;
			default: return User;
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

	async function handleExportUsers() {
		try {
			exporting = true;
			const blob = await adminReportsApi.exportUsers();
			await downloadBlobAsFile(blob, `users_${new Date().toISOString().split('T')[0]}.csv`);
			toast.success('Utilizatori exportați cu succes');
		} catch (err: any) {
			console.error('Export error:', err);
			toast.error('Eroare la export utilizatori');
		} finally {
			exporting = false;
		}
	}

	function openAddModal() {
		formMode = 'add';
		selectedUserForEdit = null;
		formData = { email: '', fullName: '', role: 'pacient', password: '' };
		formErrors = {};
		formModalOpen = true;
	}

	function openEditModal(userData: any) {
		formMode = 'edit';
		selectedUserForEdit = userData;
		formData = {
			email: userData.email || '',
			fullName: userData.fullName || '',
			role: userData.role || 'pacient',
			password: ''
		};
		formErrors = {};
		formModalOpen = true;
	}

	function validateForm() {
		formErrors = {};

		if (!formData.email) {
			formErrors.email = 'Email este obligatoriu';
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
			formErrors.email = 'Email invalid';
		}

		if (!formData.fullName) {
			formErrors.fullName = 'Nume complet obligatoriu';
		}

		if (formMode === 'add' && !formData.password) {
			formErrors.password = 'Parola obligatorie pentru nou utilizator';
		} else if (formData.password) {
			// Validate password strength: 8+ chars, uppercase, number, special char
			const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
			if (!passwordRegex.test(formData.password)) {
				formErrors.password = 'Parola: 8+ chars, UPPERCASE, cifră, simbol (@$!%*?&)';
			}
		}

		return Object.keys(formErrors).length === 0;
	}

	async function handleFormSubmit() {
		if (!validateForm() || formLoading) return;  // Prevent race condition

		try {
			formLoading = true;

			if (formMode === 'add') {
				await api.createUser({
					email: formData.email,
					fullName: formData.fullName,
					role: formData.role as 'admin' | 'medic' | 'pacient',
					password: formData.password
				});
				toast.success('Utilizator creat cu succes');
			} else {
				const updateData: any = {
					email: formData.email,
					fullName: formData.fullName,
					role: formData.role
				};
				if (formData.password) {
					updateData.password = formData.password;
				}
				await api.updateUser(selectedUserForEdit.userId, updateData);
				toast.success('Utilizator actualizat cu succes');
			}

			formModalOpen = false;
			await loadUsers();
		} catch (err: any) {
			console.error('Form error:', err);
			toast.error(err.message || 'Eroare la salvare');
		} finally {
			formLoading = false;
		}
	}

	async function handleDeleteUser(userId: number) {
		const targetUser = users.find(u => u.userId === userId);
		if (!targetUser) return;

		const userName = targetUser.fullName || targetUser.email || 'Utilizator';

		confirmDialog.isOpen = true;
		confirmDialog.title = 'Confirmă ștergerea';
		confirmDialog.message = `Sigur vrei să ștergi utilizatorul "${userName}"? Aceasta nu se poate inversa.`;
		confirmDialog.isDangerous = true;
		confirmDialog.onConfirm = async () => {
			try {
				await api.deleteUser(userId);
				toast.success('Utilizator șters cu succes');
				await loadUsers();
			} catch (err: any) {
				console.error('Delete error:', err);
				toast.error('Eroare la ștergere');
			} finally {
				confirmDialog.isOpen = false;
			}
		};
		confirmDialog.onCancel = () => {
			confirmDialog.isOpen = false;
		};
	}

	function canModifyUser(userId: number): boolean {
		return userId !== user?.id;
	}

	function getStatusButtonClass(isActive: boolean): string {
		return isActive 
			? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800'
			: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 border border-green-200 dark:border-green-800';
	}
</script>

<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<div class="flex items-center justify-between mb-8">
		<div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2 flex items-center gap-2">
				<Users class="w-7 h-7 text-gray-900 dark:text-slate-100" />
				Gestionare Utilizatori
			</h1>
			<p class="text-sm text-gray-800 dark:text-slate-300 font-medium">Administrează rolurile și statusul utilizatorilor</p>
		</div>
		<div class="flex gap-3">
			<button
				onclick={openAddModal}
				class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm flex items-center gap-2 whitespace-nowrap"
			>
				<Plus class="w-4 h-4" />
				Adaugă Utilizator
			</button>
			<button
				onclick={handleExportUsers}
				disabled={exporting || loading}
				class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm flex items-center gap-2 whitespace-nowrap"
			>
				{#if exporting}
					<LoaderCircle class="w-4 h-4 animate-spin" />
					Exportă...
				{:else}
					<Download class="w-4 h-4" />
					Export CSV
				{/if}
			</button>
		</div>
	</div>

	{#if loading}
		<div class="flex justify-center items-center py-20">
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
		</div>
	{:else}
		<!-- Filters -->
		<Card renderCustom containerClass="p-6 mb-6">
			<div class="flex items-center gap-2 mb-4">
				<Search class="w-5 h-5 text-gray-700 dark:text-slate-300" />
				<h2 class="text-lg font-semibold text-gray-900 dark:text-slate-100">Filtrare și Căutare</h2>
			</div>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div>
					<label for="search" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
						Caută utilizator
					</label>
					<input
						id="search"
						type="text"
						bind:value={searchQuery}
						placeholder="Nume sau email..."
						class="w-full px-4 py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100 transition"
					/>
				</div>
				<div>
					<label for="roleFilter" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
						Filtrează după rol
					</label>
					<select
						id="roleFilter"
						bind:value={roleFilter}
						class="w-full px-4 py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100 transition"
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
		</Card>

		<!-- Users List -->
		{#if filteredUsers.length === 0}
			<Card renderCustom containerClass="p-16 text-center">
				<div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-700 mb-4">
					<Users class="h-8 w-8 text-gray-400 dark:text-slate-500" />
				</div>
				<p class="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">Niciun utilizator găsit</p>
				<p class="text-gray-500 dark:text-slate-400">Încearcă să schimbi criteriile de căutare</p>
			</Card>
		{:else}
			<Card renderCustom containerClass="p-0 overflow-hidden">
				<div class="hidden md:block overflow-x-auto">
					<table class="w-full">
						<thead class="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-800/50 border-b border-gray-200 dark:border-slate-700">
							<tr>
								<th class="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
									<span class="inline-flex items-center gap-2">
										<User class="w-4 h-4" />
										Utilizator
									</span>
								</th>
								<th class="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
									<span class="inline-flex items-center gap-2">
										<Target class="w-4 h-4" />
										Rol
									</span>
								</th>
								<th class="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
									<span class="inline-flex items-center gap-2">
										<Zap class="w-4 h-4" />
										Status
									</span>
								</th>
								<th class="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
									<span class="inline-flex items-center gap-2">
										<CalendarDays class="w-4 h-4" />
										Data Creării
									</span>
								</th>
								<th class="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
									<span class="inline-flex items-center gap-2">
										<Settings class="w-4 h-4" />
										Acțiuni
									</span>
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
							{#each filteredUsers as u}							{@const RoleIcon = getRoleIconComponent(u.role)}								<tr class="hover:bg-blue-50/50 dark:hover:bg-slate-700/30 transition duration-150">
									<td class="px-6 py-4">
										<div class="flex items-center gap-3">
											<div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md">
												{(u.fullName || 'U').charAt(0).toUpperCase()}
											</div>
											<div class="min-w-0">
												<p class="font-semibold text-gray-900 dark:text-slate-100 truncate">{u.fullName || 'Unknown'}</p>
												<p class="text-xs text-gray-500 dark:text-slate-400 truncate">{u.email || 'N/A'}</p>
											</div>
										</div>
									</td>
									<td class="px-6 py-4">
										<span class="px-3 py-1 rounded-full text-xs font-semibold {getRoleBadgeColor(u.role)} inline-flex items-center gap-2">
										<RoleIcon class="w-4 h-4" />
											{u.role.charAt(0).toUpperCase() + u.role.slice(1)}
										</span>
									</td>
									<td class="px-6 py-4">
										<span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold {u.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'}">
											<span class="w-2 h-2 rounded-full {u.isActive ? 'bg-green-500' : 'bg-red-500'} animate-pulse"></span>
											{u.isActive ? 'Activ' : 'Inactiv'}
										</span>
									</td>
									<td class="px-6 py-4">
										<p class="text-sm text-gray-600 dark:text-slate-400">
											{formatDate(u.createdAt)}
										</p>
									</td>
									<td class="px-6 py-4 text-right">
										<div class="flex items-center justify-end gap-2">
											<button
												onclick={() => openEditModal(u)}
												class="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-sm font-medium rounded-lg transition border border-blue-200 dark:border-blue-800 whitespace-nowrap inline-flex items-center gap-2"
												title="Editează utilizatorul"
											>
												<Pencil class="w-4 h-4" />
												Editează
											</button>
											<button
												onclick={() => toggleUserStatus((u as any).userId, (u as any).isActive)}
												disabled={!canModifyUser((u as any).userId)}
												class="px-3 py-2 text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap {getStatusButtonClass((u as any).isActive)}"
												title={!canModifyUser((u as any).userId) ? 'Nu puteți modifica propriul account' : ''}
											>
												{#if (u as any).isActive}
													<span class="inline-flex items-center gap-2">
														<Ban class="w-4 h-4" />
														Dezactivează
													</span>
												{:else}
													<span class="inline-flex items-center gap-2">
														<CheckCircle2 class="w-4 h-4" />
														Activează
													</span>
												{/if}
											</button>
											<button
												onclick={() => handleDeleteUser((u as any).userId)}
												disabled={!canModifyUser((u as any).userId)}
												class="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 text-sm font-medium rounded-lg transition border border-red-200 dark:border-red-800 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap inline-flex items-center gap-2"
												title={!canModifyUser((u as any).userId) ? 'Nu puteți șterge propriul account' : 'Șterge utilizatorul'}
											>
												<Trash2 class="w-4 h-4" />
												Șterge
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
					{#each filteredUsers as u}					{@const RoleIcon = getRoleIconComponent(u.role)}						<div class="p-5 space-y-4 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition">
							<!-- Header with name and status -->
							<div class="flex items-start justify-between gap-3">
								<div class="flex items-center gap-3 flex-1 min-w-0">
									<div class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0 shadow-md">
										{(u.fullName || 'U').charAt(0).toUpperCase()}
									</div>
									<div class="flex-1 min-w-0">
										<p class="font-semibold text-gray-900 dark:text-slate-100 truncate text-sm">{u.fullName || 'Unknown'}</p>
										<p class="text-xs text-gray-500 dark:text-slate-400 truncate">{u.email || 'N/A'}</p>
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
									<p class="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Rol</p>

							<span class="px-2.5 py-1 rounded-full text-xs font-semibold {getRoleBadgeColor(u.role)} inline-flex items-center gap-2">
								<RoleIcon class="w-3.5 h-3.5" />
										{u.role.charAt(0).toUpperCase() + u.role.slice(1)}
									</span>
								</div>
								<div>
									<p class="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Creat</p>
									<p class="text-xs text-gray-700 dark:text-slate-300">
										{formatDate(u.createdAt, 'short')}
									</p>
								</div>
							</div>

							<!-- Actions -->
							<div class="flex gap-2 pt-2">
								<button
									onclick={() => openEditModal(u)}
									class="flex-1 px-3 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-sm font-medium rounded-lg transition inline-flex items-center justify-center gap-2"
									title="Editează utilizatorul"
								>
									<Pencil class="w-4 h-4" />
									Editează
								</button>
								<button
									onclick={() => toggleUserStatus(u.userId, u.isActive)}
									disabled={!canModifyUser(u.userId)}
									class="flex-1 px-3 py-2.5 text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed {getStatusButtonClass(u.isActive)}"
									title={!canModifyUser(u.userId) ? 'Nu puteți modifica propriul account' : ''}
								>
									{#if u.isActive}
										<span class="inline-flex items-center gap-2">
											<Ban class="w-4 h-4" />
											Dezactivează
										</span>
									{:else}
										<span class="inline-flex items-center gap-2">
											<CheckCircle2 class="w-4 h-4" />
											Activează
										</span>
									{/if}
								</button>
								<button
									onclick={() => handleDeleteUser(u.userId)}
									disabled={!canModifyUser(u.userId)}
									class="flex-1 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
									title={!canModifyUser(u.userId) ? 'Nu puteți șterge propriul account' : 'Șterge utilizatorul'}
								>
									<Trash2 class="w-4 h-4" />
									Șterge
								</button>
							</div>
						</div>
					{/each}
				</div>
			</Card>
		{/if}
	{/if}
</main>

<Modal
	isOpen={formModalOpen}
	title={formMode === 'add' ? 'Adaugă Utilizator Nou' : 'Editează Utilizator'}
	size="md"
	showCancel={true}
	confirmText={formLoading ? 'Se salvează...' : 'Salvează'}
	cancelText="Anulează"
	onConfirm={handleFormSubmit}
	onCancel={() => (formModalOpen = false)}
	isLoading={formLoading}
	onClose={() => (formModalOpen = false)}
>
	{#snippet children()}
		<div class="space-y-4">
			<!-- Email -->
			<div>
				<label for="email" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
					Email
				</label>
				<input
					id="email"
					type="email"
					bind:value={formData.email}
					oninput={(e) => {
						formData.email = e.currentTarget.value.toLowerCase().trim();
						if (formErrors.email) delete formErrors.email;
					}}
					placeholder="utilizator@email.com"
					class="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					disabled={formLoading}
				/>
				{#if formErrors.email}
					<p class="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.email}</p>
				{/if}
			</div>

			<!-- Full Name -->
			<div>
				<label for="fullName" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
					Nume Complet
				</label>
				<input
					id="fullName"
					type="text"
					bind:value={formData.fullName}
					oninput={() => {
						if (formErrors.fullName) delete formErrors.fullName;
					}}
					placeholder="Nume Prenume"
					class="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					disabled={formLoading}
				/>
				{#if formErrors.fullName}
					<p class="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.fullName}</p>
				{/if}
			</div>

			<!-- Role -->
			<div>
				<label for="role" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
					Rol
				</label>
				<select
					id="role"
					bind:value={formData.role}
					class="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					disabled={formLoading}
				>
				<option value="pacient">Pacient</option>
				<option value="medic">Medic</option>
				<option value="admin">Administrator</option>
				</select>
			</div>

			<!-- Password -->
			<div>
				<label for="password" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
					Parola {formMode === 'edit' ? '(opțional)' : ''}
				</label>
				<input
					id="password"
					type="password"
					bind:value={formData.password}
					oninput={() => {
						if (formErrors.password) delete formErrors.password;
					}}
					placeholder={formMode === 'edit' ? 'Lăsați gol pentru a păstra parola actuală' : 'Minim 8 chars: UPPERCASE, cifră, simbol (@$!%*?&)'}
					class="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					disabled={formLoading}
				/>
				{#if formErrors.password}
					<p class="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.password}</p>
				{/if}
			</div>
		</div>
	{/snippet}
</Modal>

<ConfirmDialog
	isOpen={confirmDialog.isOpen}
	title={confirmDialog.title}
	message={confirmDialog.message}
	isDangerous={confirmDialog.isDangerous}
	onConfirm={confirmDialog.onConfirm}
	onCancel={confirmDialog.onCancel}
/>
