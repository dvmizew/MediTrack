<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { authStore, isMedic, isPacient } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import { socketClient } from '$lib/api/socket';
	import { notificationStore, toastStore } from '$lib/stores/notifications';
	import { themeStore } from '$lib/stores/theme';

	let notifications = $state<any[]>([]);
	let showNotifications = $state(false);
	let showUserMenu = $state(false);
	let showMobileMenu = $state(false);
	let unreadCount = $derived(notifications.filter((n) => !n.isRead).length);

	onMount(async () => {
		await loadNotifications();
		
		// Listen for real-time Socket.IO notifications
		window.addEventListener('notification', handleRealtimeNotification as EventListener);
		
		// Close dropdowns on click outside
		window.addEventListener('click', handleClickOutside);
	});

	onDestroy(() => {
		window.removeEventListener('notification', handleRealtimeNotification as EventListener);
		window.removeEventListener('click', handleClickOutside);
	});

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.dropdown-container')) {
			showNotifications = false;
			showUserMenu = false;
		}
	}

	function handleRealtimeNotification(event: CustomEvent) {
		const data = event.detail;
		
		// Add to notifications list
		const newNotification = {
			id: Date.now(),
			type: data.type || 'info',
			title: data.title || 'Notificare nouă',
			message: data.message || '',
			isRead: false,
			createdAt: new Date().toISOString(),
			referenceId: data.referenceId
		};
		
		notifications = [newNotification, ...notifications];
		notificationStore.add(newNotification);
		
		// Show toast notification
		let toastType: 'success' | 'info' | 'warning' | 'error' = 'info';
		if (data.type === 'reminder') toastType = 'warning';
		else if (data.type === 'alert') toastType = 'success';
		else if (data.type === 'chat') toastType = 'info';
		
		toastStore.add({
			type: toastType,
			title: newNotification.title,
			message: newNotification.message,
			duration: 5000
		});
		
		// Play notification sound if browser supports it
		if (typeof Audio !== 'undefined') {
			try {
				const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBWuu/c');
				audio.volume = 0.3;
				audio.play().catch(() => {});
			} catch {}
		}
	}

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

<header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 shadow-sm">
	<nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex justify-between items-center h-16">
			<!-- Logo -->
			<a href="/dashboard" class="flex items-center gap-2 group">
				<div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
					<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
					</svg>
				</div>
				<span class="text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">MediTrack</span>
			</a>

			<!-- Desktop Navigation Links -->
			{#if $authStore.user}
				<div class="hidden md:flex items-center gap-1">
					<a 
					href="/dashboard" 
					class={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
						isActive('/dashboard')
							? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 scale-105'
							: 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:scale-105'
					}`}
				>
						Dashboard
					</a>
					<a 
					href="/treatments" 
					class={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
						isActive('/treatments')
							? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 scale-105'
							: 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:scale-105'
					}`}
				>
						Tratamente
					</a>
					<a 
					href="/chat" 
					class={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
						isActive('/chat')
							? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 scale-105'
							: 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:scale-105'
					}`}
				>
						Mesaje
					</a>
					<a 
					href="/collaborations" 
					class={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
						isActive('/collaborations')
							? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 scale-105'
							: 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:scale-105'
					}`}
				>
						Colaborări
					</a>
				</div>

				<!-- Right Side Actions -->
				<div class="flex items-center gap-2">
				<!-- Theme Toggle -->
				<button
					onclick={() => themeStore.toggle()}
					class="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95"
					aria-label="Toggle theme"
					type="button"
				>
					{#if $themeStore === 'dark'}
						<!-- Sun icon for light mode -->
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
						</svg>
					{:else}
						<!-- Moon icon for dark mode -->
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
						</svg>
					{/if}
				</button>
				
				<!-- Notifications -->
					<div class="relative dropdown-container">
						<button
							onclick={() => {showNotifications = !showNotifications; showUserMenu = false; showMobileMenu = false;}}
							class="relative p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
							</svg>
							{#if unreadCount > 0}
								<span class="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
									{unreadCount > 9 ? '9+' : unreadCount}
								</span>
							{/if}
						</button>

					{#if showNotifications}
						<div class="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 animate-dropdown">
								<div class="p-4 border-b border-gray-200 flex justify-between items-center">
									<h3 class="font-semibold text-gray-900 dark:text-gray-100">Notificări</h3>
									{#if unreadCount > 0}
										<button onclick={markAllAsRead} class="text-xs text-blue-600 hover:text-blue-700 font-medium">
											Marchează tot
										</button>
									{/if}
								</div>
								<div class="max-h-96 overflow-y-auto">
									{#if notifications.length === 0}
										<div class="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
											<svg class="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
											</svg>
											Nu ai notificări
										</div>
									{:else}
										{#each notifications as notification}
											<button
												onclick={() => markAsRead(notification.id)}
												class="w-full p-4 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 text-left transition"
												class:bg-blue-50={!notification.isRead}
											>
												<div class="flex gap-3">
													<div class="flex-1 min-w-0">
													<h4 class="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{notification.title}</h4>
													<p class="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{notification.message}</p>
													<p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
															{new Date(notification.createdAt).toLocaleString('ro-RO')}
														</p>
													</div>
													{#if !notification.isRead}
														<div class="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
													{/if}
												</div>
											</button>
										{/each}
									{/if}
								</div>
							</div>
						{/if}
					</div>

				<!-- User Menu (Desktop) -->
				<div class="hidden md:block relative dropdown-container">
					<button
						onclick={() => {showUserMenu = !showUserMenu; showNotifications = false; showMobileMenu = false;}}
						class="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition focus:outline-none"
					>
						<div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
							<span class="text-white text-sm font-medium">{$authStore.user.fullName.charAt(0).toUpperCase()}</span>
						</div>
					</button>						{#if showUserMenu}
					<div class="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 animate-dropdown">
						<div class="p-4 border-b border-gray-200 dark:border-gray-700">
							<p class="font-medium text-gray-900 dark:text-gray-100">{$authStore.user.fullName}</p>
							<p class="text-sm text-gray-500 dark:text-gray-400 capitalize">{$authStore.user.role}</p>
							{#if $isPacient}
								<p class="text-xs text-blue-600 dark:text-blue-400 mt-1">{$authStore.user.totalXp || 0} XP</p>
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

					<!-- Mobile Menu Button -->
					<button
						onclick={() => {showMobileMenu = !showMobileMenu; showNotifications = false; showUserMenu = false;}}
						class="md:hidden p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
						aria-label="Toggle menu"
					>
						{#if showMobileMenu}
							<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
							</svg>
						{:else}
							<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
							</svg>
						{/if}
					</button>
				</div>
			{/if}
		</div>

		<!-- Mobile Menu -->
		{#if showMobileMenu && $authStore.user}
			<div class="md:hidden border-t border-gray-200 dark:border-gray-700 py-4">
				<div class="flex flex-col gap-1">
					<a 
						href="/dashboard" 
						onclick={() => showMobileMenu = false}
						class={`px-3 py-3 rounded-lg text-sm font-medium transition ${
							isActive('/dashboard')
								? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
								: 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
						}`}
					>
						📊 Dashboard
					</a>
				<a 
					href="/treatments" 
					onclick={() => showMobileMenu = false}
					class={`px-3 py-3 rounded-lg text-sm font-medium transition ${isActive('/treatments') ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
				>
						💊 Tratamente
					</a>
					<a 
						href="/chat" 
						onclick={() => showMobileMenu = false}
						class={`px-3 py-3 rounded-lg text-sm font-medium transition ${
							isActive('/chat')
								? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
								: 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
						}`}
					>
						💬 Mesaje
					</a>
				<a 
					href="/collaborations" 
					onclick={() => showMobileMenu = false}
					class={`px-3 py-3 rounded-lg text-sm font-medium transition ${isActive('/collaborations') ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
				>
						🤝 Colaborări
					</a>
				</div>

				<!-- Mobile User Info & Logout -->
				<div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
					<div class="px-3 py-2">
						<div class="flex items-center gap-3 mb-3">
							<div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
								<span class="text-white font-medium">{$authStore.user.fullName.charAt(0).toUpperCase()}</span>
							</div>
							<div class="flex-1 min-w-0">
							<p class="font-medium text-gray-900 dark:text-gray-100 truncate">{$authStore.user.fullName}</p>
							<p class="text-sm text-gray-500 dark:text-gray-400 capitalize">{$authStore.user.role}</p>
								{#if $isPacient}
									<p class="text-xs text-blue-600 dark:text-blue-400">{$authStore.user.totalXp || 0} XP</p>
								{/if}
							</div>
						</div>
						<button
							onclick={handleLogout}
							class="w-full p-3 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-xl transition flex items-center gap-2"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
							</svg>
							Deconectare
						</button>
					</div>
				</div>
			</div>
		{/if}
	</nav>
</header>
