<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import { socketClient } from '$lib/api/socket';
	import './layout.css';

	let { children } = $props();

	onMount(async () => {
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

{@render children()}
