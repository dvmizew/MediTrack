<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import { socketClient } from '$lib/api/socket';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let fullName = $state('');
	let isRegister = $state(false);
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;

		try {
			if (isRegister) {
				const response = await api.register({ email, password, fullName });
				authStore.login(response.token, response.user);
			} else {
				const response = await api.login({ email, password });
				authStore.login(response.token, response.user);
			}

			socketClient.connect();
			goto('/dashboard');
		} catch (err: any) {
			error = err.message || 'Authentication failed';
		} finally {
			loading = false;
		}
	}

	function handleGoogleLogin() {
		window.location.href = 'http://localhost:3000/auth/google';
	}
</script>

<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4">
	<div class="max-w-md w-full">
		<!-- Logo & Title -->
		<div class="text-center mb-8">
			<div class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg mb-4">
				<svg class="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
				</svg>
			</div>
			<h1 class="text-4xl font-bold text-gray-900 mb-2">MediTrack</h1>
			<p class="text-gray-600">{isRegister ? 'Creează cont nou' : 'Bine ai revenit!'}</p>
		</div>

		<!-- Card -->
		<div class="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
			{#if error}
			<div class="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
				{error}
			</div>
		{/if}

		<form onsubmit={handleSubmit} class="space-y-5">
			{#if isRegister}
				<div>
					<label for="fullName" class="block text-sm font-medium text-gray-700 mb-2">
						Nume complet
					</label>
					<input
						id="fullName"
						type="text"
						bind:value={fullName}
						required
						class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
						placeholder="Ion Popescu"
					/>
				</div>
			{/if}

			<div>
				<label for="email" class="block text-sm font-medium text-gray-700 mb-2">Email</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					required
					class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
					placeholder="email@example.com"
				/>
			</div>

			<div>
				<label for="password" class="block text-sm font-medium text-gray-700 mb-2">Parolă</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					required
					minlength={6}
					class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
					placeholder="••••••••"
				/>
			</div>

			<button
				type="submit"
				disabled={loading}
				class="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-xl hover:from-blue-700 hover:to-blue-800 focus:ring-4 focus:ring-blue-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
			>
				{loading ? 'Se procesează...' : isRegister ? 'Creează cont' : 'Intră în cont'}
			</button>
		</form>

		<div class="mt-6">
			<div class="relative">
				<div class="absolute inset-0 flex items-center">
					<div class="w-full border-t border-gray-200"></div>
				</div>
				<div class="relative flex justify-center text-sm">
					<span class="px-3 bg-white text-gray-500">sau</span>
				</div>
			</div>

			<button
				onclick={handleGoogleLogin}
				class="mt-4 w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 py-3 px-4 rounded-xl hover:bg-gray-50 hover:border-gray-300 focus:ring-4 focus:ring-gray-200 font-medium transition"
			>
				<svg class="w-5 h-5" viewBox="0 0 24 24">
					<path
						fill="currentColor"
						d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
					/>
					<path
						fill="currentColor"
						d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
					/>
					<path
						fill="currentColor"
						d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
					/>
					<path
						fill="currentColor"
						d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
					/>
				</svg>
				Continuă cu Google
			</button>
		</div>

		<div class="mt-6 text-center">
			<button
				onclick={() => {
					isRegister = !isRegister;
					error = '';
				}}
				class="text-blue-600 hover:text-blue-700 text-sm font-semibold transition"
			>
				{isRegister ? 'Ai deja cont? Intră în cont' : 'Nu ai cont? Creează unul'}
			</button>
		</div>
	</div>
	</div>
</div>
