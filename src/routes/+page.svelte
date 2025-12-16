<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import Auth from '$lib/components/Auth.svelte';

	let isAuthenticated = $state(false);

	onMount(() => {
		isAuthenticated = $authStore.isAuthenticated;
		console.log('[Root] Mount - authenticated:', isAuthenticated, 'path:', window.location.pathname);
		if (isAuthenticated && window.location.pathname === '/') {
			console.log('[Root] Redirecting to dashboard');
			goto('/dashboard');
		}
	});

	$effect(() => {
		isAuthenticated = $authStore.isAuthenticated;
		if (isAuthenticated && window.location.pathname === '/') {
			console.log('[Root] Effect redirect to dashboard');
			goto('/dashboard');
		}
	});
</script>

{#if !isAuthenticated}
	<Auth />
{:else}
	<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
		<div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
	</div>
{/if}
