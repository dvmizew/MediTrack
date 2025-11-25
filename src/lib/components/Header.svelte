<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { authStore, isMedic, isPacient } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import { socketClient } from '$lib/api/socket';

	let notifications = $state<any[]>([]);
	let showNotifications = $state(false);
	let showUserMenu = $state(false);
	let unreadCount = $derived(notifications.filter((n) => !n.isRead).length);

	onMount(async () => {
		await loadNotifications();
	});

	async function loadNotifications() {
		try {
			const data = await api.getNotifications();
			notifications = data;
		} catch (error) {
			console.error('Failed to load notifications:', error);
		}
	}

	async function markAsRead(id: number) {
		try {
			await api.markNotificationRead(id);
			notifications = notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
		} catch (error) {
			console.error('Failed to mark notification:', error);
		}
	}

	async function markAllAsRead() {
		try {
			await api.markAllNotificationsRead();
			notifications = notifications.map((n) => ({ ...n, isRead: true }));
		} catch (error) {
			console.error('Failed to mark all notifications:', error);
		}
	}

	function handleLogout() {
		socketClient.disconnect();
		authStore.logout();
		window.location.href = '/';
	}

	function isActive(path: string) {
		return $page.url.pathname === path || $page.url.pathname.startsWith(path + '/');
	}
</script>

<header class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
	<nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex justify-between items-center h-16">
			<!-- Logo -->
			<a href="/dashboard" class="flex items-center gap-2 group">
				<div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
					<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
					</svg>
				</div>
				<span class="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition">MediTrack</span>
			</a>

			<!-- Navigation Links -->
			{#if $authStore.user}
				<div class="hidden md:flex items-center gap-1">
					<a 
						href="/dashboard" 
						class="px-3 py-2 rounded-lg text-sm font-medium transition"
						class:text-blue-600={isActive('/dashboard')}
						class:bg-blue-50={isActive('/dashboard')}
						class:text-gray-700={!isActive('/dashboard')}
						class:hover:bg-gray-50={!isActive('/dashboard')}
					>
						Dashboard
					</a>
					<a 
						href="/treatments" 
						class="px-3 py-2 rounded-lg text-sm font-medium transition"
						class:text-blue-600={isActive('/treatments')}
						class:bg-blue-50={isActive('/treatments')}
						class:text-gray-700={!isActive('/treatments')}
						class:hover:bg-gray-50={!isActive('/treatments')}
					>
						Tratamente
					</a>
					<a 
						href="/chat" 
						class="px-3 py-2 rounded-lg text-sm font-medium transition"
						class:text-blue-600={isActive('/chat')}
						class:bg-blue-50={isActive('/chat')}
						class:text-gray-700={!isActive('/chat')}
						class:hover:bg-gray-50={!isActive('/chat')}
					>
						Mesaje
					</a>
					<a 
						href="/collaborations" 
						class="px-3 py-2 rounded-lg text-sm font-medium transition"
						class:text-blue-600={isActive('/collaborations')}
						class:bg-blue-50={isActive('/collaborations')}
						class:text-gray-700={!isActive('/collaborations')}
						class:hover:bg-gray-50={!isActive('/collaborations')}
					>
						Colaborări
					</a>
				</div>

				<!-- Right Side Actions -->
				<div class="flex items-center gap-2">
					<!-- Notifications -->
					<div class="relative">
						<button
							onclick={() => {showNotifications = !showNotifications; showUserMenu = false;}}
							class="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
							</svg>
							{#if unreadCount > 0}
								<span class="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
									{unreadCount}
								</span>
							{/if}
						</button>

						{#if showNotifications}
							<div class="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200">
								<div class="p-4 border-b border-gray-200 flex justify-between items-center">
									<h3 class="font-semibold text-gray-900">Notificări</h3>
									{#if unreadCount > 0}
										<button onclick={markAllAsRead} class="text-xs text-blue-600 hover:text-blue-700 font-medium">
											Marchează tot
										</button>
									{/if}
								</div>
								<div class="max-h-96 overflow-y-auto">
									{#if notifications.length === 0}
										<div class="p-8 text-center text-gray-500 text-sm">
											<svg class="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
											</svg>
											Nu ai notificări
										</div>
									{:else}
										{#each notifications as notification}
											<button
												onclick={() => markAsRead(notification.id)}
												class="w-full p-4 hover:bg-gray-50 border-b border-gray-100 text-left transition"
												class:bg-blue-50={!notification.isRead}
											>
												<div class="flex gap-3">
													<div class="flex-1">
														<h4 class="font-medium text-sm text-gray-900">{notification.title}</h4>
														<p class="text-sm text-gray-600 mt-1">{notification.message}</p>
														<p class="text-xs text-gray-400 mt-1">
															{new Date(notification.createdAt).toLocaleString('ro-RO')}
														</p>
													</div>
													{#if !notification.isRead}
														<div class="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
													{/if}
												</div>
											</button>
										{/each}
									{/if}
								</div>
							</div>
						{/if}
					</div>

					<!-- User Menu -->
					<div class="relative">
						<button
							onclick={() => {showUserMenu = !showUserMenu; showNotifications = false;}}
							class="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition"
						>
							<div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
								<span class="text-white text-sm font-medium">{$authStore.user.fullName.charAt(0).toUpperCase()}</span>
							</div>
						</button>

						{#if showUserMenu}
							<div class="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200">
								<div class="p-4 border-b border-gray-200">
									<p class="font-medium text-gray-900">{$authStore.user.fullName}</p>
									<p class="text-sm text-gray-500 capitalize">{$authStore.user.role}</p>
									{#if $isPacient}
										<p class="text-xs text-blue-600 mt-1">{$authStore.user.totalXp || 0} XP</p>
									{/if}
								</div>
								<button
									onclick={handleLogout}
									class="w-full p-3 text-left text-red-600 hover:bg-red-50 rounded-b-xl transition flex items-center gap-2"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
									</svg>
									Deconectare
								</button>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</nav>
</header>
