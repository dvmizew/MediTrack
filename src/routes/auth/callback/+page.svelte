<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import { socketClient } from '$lib/api/socket';

	onMount(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const token = urlParams.get('token');

		if (token) {
			authStore.setToken(token);
			
			// Fetch user profile
			fetch('http://localhost:3000/users/me', {
				headers: {
					Authorization: `Bearer ${token}`
				}
			})
				.then((res) => res.json())
				.then((user) => {
					authStore.updateUser(user);
					socketClient.connect();
					goto('/dashboard');
				})
				.catch(() => {
					authStore.logout();
					goto('/');
				});
		} else {
			goto('/');
		}
	});
</script>

<div class="min-h-screen flex items-center justify-center">
	<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
</div>
