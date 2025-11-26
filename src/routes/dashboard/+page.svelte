<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import Dashboard from '$lib/components/Dashboard.svelte';

	onMount(() => {
		if (!$authStore.isAuthenticated) {
			goto('/');
		}
	});
</script>

{#if $authStore.isAuthenticated}
	<main class="page-transition max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<Dashboard />
	</main>
{/if}
