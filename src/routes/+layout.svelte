<script lang="ts">
	import { onMount } from 'svelte';
	import { navigating } from '$app/stores';
	import { authStore } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import { socketClient } from '$lib/api/socket';
	import { toastStore, type Toast } from '$lib/stores/notifications';
	import { themeStore } from '$lib/stores/theme';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import Header from '$lib/components/Header.svelte';
	import { registerServiceWorker, setupInstallPrompt, setupNetworkDetection } from '$lib/pwa';
	import './layout.css';

	let { children } = $props();
	let toasts = $state<Toast[]>([]);

	// Subscribe to toast store
	toastStore.subscribe((value) => {
		toasts = value;
	});

	onMount(async () => {
		// Initialize theme
		themeStore.init();
		
		// Initialize PWA features
		registerServiceWorker();
		setupInstallPrompt();
		setupNetworkDetection();
		
		// Listen for network status changes
		window.addEventListener('network-status', ((event: CustomEvent) => {
			if (event.detail.online) {
				toastStore.success('Conexiune restabilită', 'Ești online');
			} else {
				toastStore.warning('Conexiune pierdută', 'Funcții limitate offline');
			}
		}) as EventListener);
		
		const { token } = $authStore;
		
		if (token) {
			try {
				const user = await api.getProfile();
				authStore.updateUser(user);
				socketClient.connect();
			} catch (error) {
				authStore.logout();
			}
		}
	});
</script>

<ToastContainer bind:toasts />

{#if $authStore.isAuthenticated}
	<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
		<Header />
		{@render children()}
	</div>
{:else}
	{@render children()}
{/if}
