<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { navigating, page } from '$app/stores';
	import { browser } from '$app/environment';
	import { authStore } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import { socketClient } from '$lib/api/socket';
	import { toastStore, type Toast } from '$lib/stores/notifications';
	import { notificationService } from '$lib/services/notificationService';
	import { themeStore } from '$lib/stores/theme';
	import { startSessionManager, stopSessionManager } from '$lib/services/sessionManager';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import Header from '$lib/components/Header.svelte';
	import KeyboardNav from '$lib/components/KeyboardNav.svelte';
	import { registerServiceWorker, setupInstallPrompt, setupNetworkDetection } from '$lib/pwa';
	import { initializePushNotifications } from '$lib/services/pushNotifications';
	import './layout.css';

	let { children } = $props();
	let toasts = $state<Toast[]>([]);

	// Subscribe to toast store with proper cleanup
	const unsubscribeToasts = toastStore.subscribe((value: Toast[]) => {
		toasts = value;
	});

	const handleNetworkStatus = ((event: CustomEvent) => {
		if (event.detail.online) {
			// Silently handle online status
		} else {
			notificationService.error('Conectare pierdută', 'Funcții limitate offline', 5000);
		}
	}) as EventListener;

	// When tab becomes visible, optimistically refresh token to keep session alive
	const handleVisibilityChange = () => {
		if (document.visibilityState === 'visible' && $authStore.token) {
			api.refreshToken()
				.then((refreshed) => {
					if (refreshed?.token) {
						authStore.setToken(refreshed.token);
					}
				})
				.catch(() => {
					// Ignore; session manager will handle periodic refresh
				});
		}
	};

	onMount(async () => {
		if (!browser) return;
		
		// Initialize theme
		themeStore.init();
		
		// Initialize PWA features
		registerServiceWorker();
		setupInstallPrompt();
		setupNetworkDetection();
		
		// Initialize push notifications (only on HTTPS or non-localhost)
		try {
			if (window.location.protocol === 'https:' || window.location.hostname !== 'localhost') {
				await initializePushNotifications();
			}
		} catch (error) {
			console.warn('Push notifications initialization failed:', error);
		}
		
		// Listen for network status changes
		window.addEventListener('network-status', handleNetworkStatus);
		document.addEventListener('visibilitychange', handleVisibilityChange);
		
		const { token } = $authStore;


			if (token) {
				try {
					// Optimistic refresh first to extend session seamlessly
					const refreshed = await api.refreshToken();
					if (refreshed?.token) {
						// Apply refreshed token immediately
						authStore.setToken(refreshed.token);
					}
					// Load profile with current (possibly refreshed) token
					const user = await api.getProfile();
					// Fully hydrate session state
					authStore.login($authStore.token!, user);
					socketClient.connect();
					startSessionManager();
				} catch (error) {
					console.error('Startup session initialization failed:', error);
					authStore.logout();
				}
			}
	});

	onDestroy(() => {
		if (!browser) return;
		
		// Cleanup subscriptions
		unsubscribeToasts();
		
		// Cleanup event listeners
		window.removeEventListener('network-status', handleNetworkStatus);
		document.removeEventListener('visibilitychange', handleVisibilityChange);
		
		// Stop session manager
		stopSessionManager();
		
		// Disconnect socket on component destroy (when user logs out)
		if (!$authStore.isAuthenticated) {
			socketClient.disconnect();
		}
	});
</script>

<ToastContainer bind:toasts />
<KeyboardNav />

{#if $authStore.isAuthenticated}
	<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
		<!-- Skip to main content link -->
		<a href="#main-content" class="skip-link">Sari la conținutul principal</a>
		
		<!-- Fixed Header visible everywhere -->
		<div class="fixed top-0 left-0 right-0 z-50">
			<Header />
		</div>
		
		<!-- Main Content with padding for fixed header -->
		<main id="main-content" class="pt-16">
			{@render children()}
		</main>
	</div>
{:else}
	<main id="main-content">
		{@render children()}
	</main>
{/if}
