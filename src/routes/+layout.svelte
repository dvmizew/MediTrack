<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { authStore } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import { socketClient } from '$lib/api/socket';
	import { themeStore } from '$lib/stores/theme';
	import { startSessionManager, stopSessionManager } from '$lib/services/sessionManager';
	import { initToast } from '$lib/utils/toast';
	import Header from '$lib/components/Header.svelte';
	import KeyboardNav from '$lib/components/KeyboardNav.svelte';
	import { registerServiceWorker } from '$lib/pwa';
	import CookieConsent from '$lib/components/CookieConsent.svelte';
	import Notifications from 'svelte-notifications';
	import './layout.css';

	let { children } = $props();

	const handleNetworkStatus = ((event: CustomEvent) => {
		// Just listen for network changes, no notifications
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
		
		// Initialize toast notifications
		initToast();
		
		// Initialize PWA features
		registerServiceWorker();
		
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

<KeyboardNav />

{#if $authStore.isAuthenticated}
	<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
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

<!-- GDPR Cookie Consent (global) -->
<CookieConsent />

<!-- Toast Notifications (global) -->
<Notifications />
