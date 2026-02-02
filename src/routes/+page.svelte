<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import Auth from '$lib/components/Auth.svelte';

	let isAuthenticated = $state(false);

	onMount(() => {
		isAuthenticated = $authStore.isAuthenticated;
		if (isAuthenticated && window.location.pathname === '/') {
			goto('/dashboard');
		}
	});

	$effect(() => {
		isAuthenticated = $authStore.isAuthenticated;
		if (isAuthenticated && window.location.pathname === '/') {
			goto('/dashboard');
		}
	});
</script>

{#if !isAuthenticated}
	<Auth />
{:else}
	<div class="min-h-screen flex items-center justify-center">
		<div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
	</div>
{/if}
