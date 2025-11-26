<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import Header from '$lib/components/Header.svelte';
	import Dashboard from '$lib/components/Dashboard.svelte';

	onMount(() => {
		if (!$authStore.isAuthenticated) {
			goto('/');
		}
	});
</script>

{#if $authStore.isAuthenticated}
	<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
		<Header />
		<main class="page-transition max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<Dashboard />
		</main>
	</div>
{/if}
