<script lang="ts">
	import { authStore } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	
	let { children } = $props();
	
	onMount(() => {
		if (!$authStore.isAuthenticated) {
			goto('/');
		}
	});
</script>

<!-- Chat pages use their own fullscreen layout -->
{@render children()}
