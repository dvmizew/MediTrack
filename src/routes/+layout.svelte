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

<!-- Skip to main content link for keyboard navigation -->
<a 
	href="#main-content" 
	class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:shadow-lg"
>
	Sari la conținutul principal
</a>

{#if $authStore.isAuthenticated}
	<div class="min-h-screen">
		<!-- Fixed Header visible everywhere -->
		<header class="fixed top-0 left-0 right-0 z-50">
			<Header />
		</header>
		
		<!-- Main Content with padding for fixed header -->
		<main id="main-content" class="pt-16" aria-label="Conținut principal">
			{@render children()}
		</main>
	</div>
{:else}
	<div class="min-h-screen">
		<main id="main-content" aria-label="Conținut principal">
			{@render children()}
		</main>
	</div>
{/if}

<!-- GDPR Cookie Consent (global) -->
<CookieConsent />

<!-- Toast Notifications (global) -->
<Notifications />
