<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { page } from '$app/stores';
	import { authStore, isPacient } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import { systemNotificationStore } from '$lib/stores/notifications';
	import { themeStore } from '$lib/stores/theme';
	import { logout as sessionLogout } from '$lib/services/sessionManager';
	import { BarChart3, Pill, MessageCircle, Users, Trophy, Check, Bell, Menu, X, User, Sun, Moon, Trash2, ChevronDown, ChevronRight, AlertCircle, ClipboardList, Clock, Settings, LogOut } from '@lucide/svelte';
	import AccessibilityMenu from './AccessibilityMenu.svelte';

	let notifications = $state<any[]>([]);
	let showNotifications = $state(false);
	let showUserMenu = $state(false);
	let showMobileMenu = $state(false);
	let notificationFilter = $state<'all' | 'unread'>('all');
	let unreadCount = $derived(notifications.filter((n) => !n.isRead).length);
	let filteredNotifications = $derived(
		notificationFilter === 'unread' 
			? notifications.filter(n => !n.isRead)
			: notifications
	);

	onMount(async () => {
		await loadNotifications();
		
		// Listen for real-time Socket.IO notifications
		window.addEventListener('notification', handleRealtimeNotification as EventListener);
		
		// Close dropdowns on click outside
		window.addEventListener('click', handleClickOutside);
		
		// Close dropdowns on ESC key
		window.addEventListener('keydown', handleKeyDown);
	});

	onDestroy(() => {
		window.removeEventListener('notification', handleRealtimeNotification as EventListener);
		window.removeEventListener('click', handleClickOutside);
		window.removeEventListener('keydown', handleKeyDown);
	});

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		// Don't interfere with navigation links
		if (target.closest('a[href]')) {
			return;
		}
		if (!target.closest('.dropdown-container')) {
			showNotifications = false;
			showUserMenu = false;
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
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
		systemNotificationStore.add(newNotification);
		
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

	// Open/toggle notifications and auto mark all as read optimistically
	async function openNotifications() {
		showNotifications = !showNotifications;
		showUserMenu = false;
		showMobileMenu = false;

		// If there are unread notifications, optimistically mark them as read and call API
		if (unreadCount > 0) {
			const prev = notifications;
			notifications = notifications.map((n) => ({ ...n, isRead: true }));
			try {
				await api.markAllNotificationsRead();
			} catch (error) {
				console.error('Failed to auto mark all as read:', error);
				// Revert if API fails
				notifications = prev;
			}
		}
	}

	async function clearAllNotifications() {
		try {
			await api.deleteAllNotifications();
			notifications = [];
		} catch (error) {
			console.error('Failed to clear notifications:', error);
		}
	}

	async function deleteNotification(id: number, event?: MouseEvent) {
		if (event) {
			event.stopPropagation();
		}
		try {
			await api.deleteNotification(id);
			notifications = notifications.filter(n => n.id !== id);
		} catch (error) {
			console.error('Failed to delete notification:', error);
		}
	}

	function handleNotificationClick(notification: any) {
		// Mark as read
		markAsRead(notification.id);
		
		// Close on mobile (md breakpoint = 768px)
		if (window.innerWidth < 768) {
			showNotifications = false;
		}
		
		// Navigate based on notification type
		switch (notification.type) {
			case 'medication':
			case 'reminder':
			case 'treatment_update':
				window.location.href = '/treatments';
				break;
			case 'chat':
				if (notification.referenceId) {
					window.location.href = `/chat/${notification.referenceId}`;
				} else {
					window.location.href = '/chat';
				}
				break;
			case 'invite':
				window.location.href = '/collaborations';
				break;
			case 'alert':
			default:
				window.location.href = '/dashboard';
				break;
		}
	}

	function handleLogout() {
		// Use session manager logout which handles cleanup
		sessionLogout();
	}

	function isActive(path: string) {
		return $page.url.pathname === path;
	}

	function getNotificationIcon(type: string) {
		switch (type) {
			case 'medication':
				return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>';
			case 'chat':
				return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>';
			case 'invite':
				return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>';
			case 'treatment_update':
				return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>';
			case 'reminder':
				return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>';
			case 'alert':
				return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>';
			default:
				return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>';
		}
	}

	function getNotificationColor(type: string) {
		switch (type) {
			case 'medication': return 'text-blue-600 dark:text-blue-400';
			case 'chat': return 'text-green-600 dark:text-green-400';
			case 'invite': return 'text-purple-600 dark:text-purple-400';
			case 'treatment_update': return 'text-orange-600 dark:text-orange-400';
			case 'reminder': return 'text-yellow-600 dark:text-yellow-400';
			case 'alert': return 'text-red-600 dark:text-red-400';
			default: return 'text-gray-600 dark:text-slate-400';
		}
	}
</script>

<header class="bg-white/98 dark:bg-slate-800/98 backdrop-blur-md border-b border-gray-200 dark:border-slate-700 shadow-sm">
	<nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Navigare principală">
		<div class="flex justify-between items-center h-16">
			<!-- Logo -->
			<a href="/dashboard" class="flex items-center gap-2 group" aria-label="MediTrack - mergi la Dashboard">
				<div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center" aria-hidden="true">
					<ClipboardList class="w-5 h-5 text-white" />
				</div>
				<span class="text-xl font-bold text-gray-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">MediTrack</span>
			</a>

			<!-- Desktop Navigation Links -->
			{#if $authStore.user}
				<div class="hidden md:flex items-center gap-1">
					<a 
					href="/dashboard" 
					class={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
						isActive('/dashboard')
							? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 scale-105'
							: 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:scale-105'
					}`}
				>
						Dashboard
					</a>
					<a 
					href="/treatments" 
					class={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
						isActive('/treatments')
							? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 scale-105'
							: 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:scale-105'
					}`}
				>
						Tratamente
					</a>
					<a 
					href="/chat" 
					class={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
						isActive('/chat')
							? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 scale-105'
							: 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:scale-105'
					}`}
				>
						Mesaje
					</a>
					<a 
					href="/collaborations" 
					class={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
						isActive('/collaborations')
							? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 scale-105'
							: 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:scale-105'
					}`}
				>
						Colaborări
				</a>
				<a 
				href="/leaderboard" 
				class={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
					isActive('/leaderboard')
						? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 scale-105'
						: 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:scale-105'
				}`}
				>
					<Trophy class="w-5 h-5 mr-1 inline" />
					Leaderboard
				</a>
			</div>
				<!-- Right Side Actions -->
				<div class="flex items-center gap-2">
				<!-- Accessibility Menu -->
				<AccessibilityMenu />
				
				<!-- Theme Toggle -->
				<button
					onclick={() => themeStore.toggle()}
					class="p-2 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95"
					aria-label={$themeStore === 'dark' ? 'Comută la modul luminos' : 'Comută la modul întunecat'}
					aria-pressed={$themeStore === 'dark'}
					type="button"
				>
					{#if $themeStore === 'dark'}
						<!-- Sun icon for light mode -->
					<Sun class="w-5 h-5" />
					{:else}
						<!-- Moon icon for dark mode -->
					<Moon class="w-5 h-5" />
					{/if}
				</button>
				
				<!-- Notifications -->
					<div class="relative dropdown-container">
						<button
							onclick={openNotifications}
							class="relative p-2 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition active:scale-95 min-w-10 h-10"
							aria-label={unreadCount > 0 ? `Notificări (${unreadCount} necitite)` : 'Notificări'}
							aria-expanded={showNotifications}
							aria-haspopup="true"
							type="button"
						>
						<Bell class="w-5 h-5" aria-hidden="true" />
							{#if unreadCount > 0}
								<span class="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
									{unreadCount > 99 ? '99' : unreadCount}
								</span>
							{/if}
						</button>

					{#if showNotifications}
						<!-- Mobile Modal Overlay -->
						<div 
							class="md:hidden fixed inset-0 z-40 bg-black/40"
							onclick={() => showNotifications = false}
							onkeydown={(e) => e.key === 'Escape' && (showNotifications = false)}
							role="button"
							tabindex={0}
							aria-label="Inchide notificari"
						></div>

						<div 
							transition:fly={{ y: -10, duration: 300, easing: quintOut }}
													class="fixed md:absolute bottom-0 md:bottom-auto left-0 md:left-auto right-0 md:right-0 top-16 md:top-auto md:mt-2 w-full md:w-96 h-[calc(100vh-4rem)] md:h-auto max-h-screen md:max-h-[32rem] md:rounded-xl rounded-t-2xl shadow-2xl border border-gray-200 dark:border-slate-700 bg-white/98 dark:bg-slate-800/98 backdrop-blur-md overflow-hidden z-50 flex flex-col md:block"
							data-arrow-nav="true"
						>
							<!-- Header with actions -->
							<div class="p-3 sm:p-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 flex-shrink-0">
								<div class="flex justify-between items-center gap-2 mb-2 sm:mb-3">
									<h3 class="font-bold text-gray-900 dark:text-slate-100 text-base sm:text-lg flex-1 truncate">Notificări</h3>
									<div class="flex gap-1 sm:gap-2 flex-shrink-0">
										<!-- Mobile Close Button -->
										<button 
											onclick={() => showNotifications = false}
											class="md:hidden p-1 sm:p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-all duration-200 active:scale-90"
											aria-label="Inchide notificari"
										>
										<X class="w-4 h-4 sm:w-5 sm:h-5" />
									</button>
									
									{#if notifications.length > 0}
										<button 
											onclick={clearAllNotifications}
											class="text-xs px-2 py-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 font-medium active:scale-90"
											title="Șterge toate"
											aria-label="Sterge toate notificările"
										>
											<Trash2 class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
											</button>
										{/if}
										{#if unreadCount > 0}
											<button 
												onclick={markAllAsRead} 
												class="text-[10px] sm:text-xs px-2 sm:px-3 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200 font-medium whitespace-nowrap active:scale-90"
												aria-label="Marcheaza toate notificările ca citite"
											>
												<span class="hidden sm:inline">Marchează tot</span>
												<span class="sm:hidden flex items-center gap-1">
													<Check class="w-3 h-3" />
													Tot
												</span>
											</button>
										{/if}
									</div>
								</div>
								
								<!-- Filter tabs -->
								<div class="flex gap-2 px-3 sm:px-4 py-2 sm:py-3 border-t border-gray-100 dark:border-slate-700 flex-shrink-0">
									<button
										onclick={() => notificationFilter = 'all'}
										class="flex-1 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg transition-all duration-200 truncate active:scale-95"
										class:bg-blue-600={notificationFilter === 'all'}
										class:text-white={notificationFilter === 'all'}
										class:text-gray-600={notificationFilter !== 'all'}
										class:dark:text-slate-400={notificationFilter !== 'all'}
										class:hover:bg-gray-100={notificationFilter !== 'all'}
										class:dark:hover:bg-slate-700={notificationFilter !== 'all'}
									>
										Toate ({notifications.length})
									</button>
									<button
										onclick={() => notificationFilter = 'unread'}
										class="flex-1 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg transition-all duration-200 relative truncate active:scale-95"
										class:bg-blue-600={notificationFilter === 'unread'}
										class:text-white={notificationFilter === 'unread'}
										class:text-gray-600={notificationFilter !== 'unread'}
										class:dark:text-slate-400={notificationFilter !== 'unread'}
										class:hover:bg-gray-100={notificationFilter !== 'unread'}
										class:dark:hover:bg-slate-700={notificationFilter !== 'unread'}
									>
										Necitite ({unreadCount})
										{#if unreadCount > 0}
											<span class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
										{/if}
									</button>
								</div>
							</div>

							<!-- Notifications list -->
							<div class="flex-1 md:flex-none md:max-h-[60vh] sm:md:max-h-[32rem] overflow-y-auto overflow-x-hidden">
								{#if filteredNotifications.length === 0}
									<div class="p-8 sm:p-12 text-center">
										<div class="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
										<Bell class="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 dark:text-slate-500" />
										</div>
										<p class="text-gray-500 dark:text-slate-400 text-xs sm:text-sm font-medium">
											{notificationFilter === 'unread' ? 'Nu ai notificări necitite' : 'Nu ai notificări'}
										</p>
									</div>
								{:else}
								{#each filteredNotifications as notification, index (notification.id)}
									<div
										in:fly={{ x: -20, duration: 300, delay: index * 30, easing: quintOut }}
										class="group relative border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-all duration-200"
									class:bg-blue-50={!notification.isRead}
									class:dark:bg-blue-900={!notification.isRead}
								>
										<button
											onclick={() => handleNotificationClick(notification)}
											class="w-full p-3 sm:p-4 text-left flex gap-2 sm:gap-3 hover:scale-[1.01] active:scale-[0.99] transition-transform duration-200"
											>
												<!-- Icon -->
												<div class="flex-shrink-0 mt-0.5 sm:mt-1">
													<div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center {getNotificationColor(notification.type)}">
														<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															{@html getNotificationIcon(notification.type)}
														</svg>
													</div>
												</div>
												
												<!-- Content -->
												<div class="flex-1 min-w-0 pr-6 sm:pr-8">
													<div class="flex items-start justify-between gap-2">
														<h4 class="font-semibold text-xs sm:text-sm text-gray-900 dark:text-slate-100 truncate">
															{notification.title}
														</h4>
														{#if !notification.isRead}
															<div class="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1.5"></div>
														{/if}
													</div>
													<p class="text-[10px] sm:text-xs text-gray-600 dark:text-slate-400 mt-1 line-clamp-2 break-words">
														{notification.message}
													</p>
													<div class="flex items-center justify-between mt-1.5 sm:mt-2">
														<p class="text-[10px] sm:text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1 truncate">
													<Clock class="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
															<span class="truncate">{new Date(notification.createdAt).toLocaleString('ro-RO', { 
																day: 'numeric', 
																month: 'short', 
																hour: '2-digit', 
																minute: '2-digit' 
															})}</span>
														</p>
													</div>
												</div>
											</button>
											
										<!-- Delete button (appears on hover) -->
										<button
											onclick={(event) => deleteNotification(notification.id, event)}
											class="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 p-1 sm:p-1.5 opacity-0 group-hover:opacity-100 bg-white/98 dark:bg-slate-800/98 backdrop-blur-md rounded-lg shadow-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
											title="Șterge notificarea"
										>
										<Trash2 class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-600 dark:text-red-400" />
										</button>
										</div>
									{/each}
								{/if}
							</div>
							
							<!-- Footer with settings link -->
							{#if notifications.length > 0}
								<div class="p-2 sm:p-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
									<a 
										href="/settings"
										class="block text-center text-[10px] sm:text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors duration-200"
									>
										Setări notificări
									</a>
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<!-- User Menu (Desktop) -->
				<div class="hidden md:block relative dropdown-container">
					<button
						onclick={() => {showUserMenu = !showUserMenu; showNotifications = false; showMobileMenu = false;}}
						class="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition focus:outline-none"
						aria-label="Meniu utilizator"
						aria-expanded={showUserMenu}
						aria-haspopup="true"
					>
						<div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
							<span class="text-white text-sm font-medium">{$authStore.user?.fullName?.charAt(0).toUpperCase() || '?'}</span>
						</div>
					</button>						{#if showUserMenu}
					<div 
						transition:fly={{ y: -10, duration: 300, easing: quintOut }}
						class="absolute right-0 mt-2 w-56 bg-white/98 dark:bg-slate-800/98 backdrop-blur-md rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 dropdown-container"
						data-arrow-nav="true"
					>
						<div class="p-4 border-b border-gray-200 dark:border-slate-700">
							<p class="font-medium text-gray-900 dark:text-slate-100">{$authStore.user?.fullName || 'User'}</p>
							<p class="text-sm text-gray-500 dark:text-slate-400 capitalize">{$authStore.user?.role || 'N/A'}</p>
							{#if $isPacient}
								<p class="text-xs text-blue-600 dark:text-blue-400 mt-1">{$authStore.user?.totalXp || 0} XP</p>
							{/if}
						</div>
						<div class="py-2">
							<a
								href="/profile"
								class="w-full px-4 py-2.5 text-left text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition flex items-center gap-3"
							>
								<User class="w-5 h-5" />
								Profil
							</a>
							<a
								href="/settings"
								class="w-full px-4 py-2.5 text-left text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition flex items-center gap-3"
							>
							<Settings class="w-5 h-5" />
								Setări
							</a>
						</div>
						<div class="border-t border-gray-200 dark:border-slate-700">
							<button
								onclick={handleLogout}
								class="w-full px-4 py-2.5 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-xl transition flex items-center gap-3"
							>
								<LogOut class="w-5 h-5" />
								Deconectare
							</button>
						</div>
					</div>
					{/if}
					</div>

					<!-- Mobile Menu Button -->
					<button
						onclick={() => {showMobileMenu = !showMobileMenu; showNotifications = false; showUserMenu = false;}}
						class="md:hidden p-2 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition"
						aria-label="Toggle menu"
					>
						{#if showMobileMenu}
							<X class="w-6 h-6" />
						{:else}
							<Menu class="w-6 h-6" />
						{/if}
					</button>
				</div>
			{/if}
		</div>

	<!-- Mobile Menu -->
	{#if showMobileMenu && $authStore.user}
		<div 
			transition:fly={{ y: -20, duration: 300, easing: quintOut }}
			class="md:hidden border-t border-gray-200 dark:border-slate-700 py-4"
		>
				<div class="flex flex-col gap-1">
					<a 
						href="/dashboard" 
						onclick={() => showMobileMenu = false}
						class={`px-3 py-3 rounded-lg text-sm font-medium transition ${
							isActive('/dashboard')
								? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
								: 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
						}`}
					>
						<BarChart3 class="w-5 h-5 mr-1" />
						Dashboard
					</a>
				<a 
					href="/treatments" 
					onclick={() => showMobileMenu = false}
					class={`px-3 py-3 rounded-lg text-sm font-medium transition ${isActive('/treatments') ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
				>
						<Pill class="w-5 h-5 mr-1" />
						Tratamente
					</a>
					<a 
						href="/chat" 
						onclick={() => showMobileMenu = false}
						class={`px-3 py-3 rounded-lg text-sm font-medium transition ${
							isActive('/chat')
								? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
								: 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
						}`}
					>
						<MessageCircle class="w-5 h-5 mr-1" />
						Mesaje
					</a>
				<a 
					href="/collaborations" 
					onclick={() => showMobileMenu = false}
					class={`px-3 py-3 rounded-lg text-sm font-medium transition ${isActive('/collaborations') ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
				>
						<Users class="w-5 h-5 mr-1" />
						Colaborări
				</a>
				<a 
				href="/leaderboard"
					onclick={() => showMobileMenu = false}
					class={`px-3 py-3 rounded-lg text-sm font-medium transition ${isActive('/leaderboard') ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
				>
					<Trophy class="w-5 h-5 mr-1" />
					Leaderboard
				</a>
			</div>

			<!-- Mobile User Info & Logout -->
			<div class="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
					<div class="px-3 py-2">
						<div class="flex items-center gap-3 mb-3">
							<div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
								<span class="text-white font-medium">{$authStore.user?.fullName?.charAt(0).toUpperCase() || '?'}</span>
							</div>
							<div class="flex-1 min-w-0">
							<p class="font-medium text-gray-900 dark:text-slate-100 truncate">{$authStore.user?.fullName || 'User'}</p>
							<p class="text-sm text-gray-500 dark:text-slate-400 capitalize">{$authStore.user?.role || 'N/A'}</p>
								{#if $isPacient}
									<p class="text-xs text-blue-600 dark:text-blue-400">{$authStore.user?.totalXp || 0} XP</p>
								{/if}
							</div>
						</div>
						<button
							onclick={handleLogout}
							class="w-full p-3 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-xl transition flex items-center gap-2"
						>
							<LogOut class="w-5 h-5" />
							Deconectare
						</button>
					</div>
				</div>
			</div>
		{/if}
	</nav>

</header>
