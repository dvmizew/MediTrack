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
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import Header from '$lib/components/Header.svelte';
	import { registerServiceWorker, setupInstallPrompt, setupNetworkDetection } from '$lib/pwa';
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

	onMount(async () => {
		if (!browser) return;
		
		// Initialize theme
		themeStore.init();
		
		// Initialize PWA features
		registerServiceWorker();
		setupInstallPrompt();
		setupNetworkDetection();
		
		// Listen for network status changes
		window.addEventListener('network-status', handleNetworkStatus);
		
		const { token } = $authStore;
		
		if (token) {
			try {
				const user = await api.getProfile();
				authStore.updateUser(user);
				socketClient.connect();
			} catch (error) {
				console.error('Failed to load profile:', error);
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
		
		// Disconnect socket on component destroy (when user logs out)
		if (!$authStore.isAuthenticated) {
			socketClient.disconnect();
		}
	});
</script>

<ToastContainer bind:toasts />

{#if $authStore.isAuthenticated}
	<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
		<!-- Fixed Header visible everywhere -->
		<div class="fixed top-0 left-0 right-0 z-50">
			<Header />
		</div>
		
		<!-- Main Content with padding for fixed header -->
		<div class="pt-16">
			{@render children()}
		</div>
	</div>
{:else}
	{@render children()}
{/if}
