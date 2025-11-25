<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import Auth from '$lib/components/Auth.svelte';

	onMount(() => {
		if ($authStore.isAuthenticated) {
			goto('/dashboard');
		}
	});
</script>

<Auth />
