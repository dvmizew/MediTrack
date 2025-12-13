<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, slide } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { authStore } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import { socketClient } from '$lib/api/socket';
	import { themeStore } from '$lib/stores/theme';
	import { goto } from '$app/navigation';
	import { authLoginSchema, authRegisterSchema, parseWithFriendlyErrors } from '$lib/validation/schemas';

	let email = $state('');
	let password = $state('');
	let fullName = $state('');
	let isRegister = $state(false);
	let error = $state('');
	let loading = $state(false);

	onMount(() => {
		themeStore.init();
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;

		try {
			if (isRegister) {
				const parsed = parseWithFriendlyErrors(authRegisterSchema, { email, password, fullName });
				if (!parsed.success) {
					error = parsed.errors.join('\n');
					return;
				}
				const response = await api.register(parsed.data);
				authStore.login(response.token, response.user);
			} else {
				const parsed = parseWithFriendlyErrors(authLoginSchema, { email, password });
				if (!parsed.success) {
					error = parsed.errors.join('\n');
					return;
				}
				const response = await api.login(parsed.data);
				authStore.login(response.token, response.user);
			}

			socketClient.connect();
			goto('/dashboard');
		} catch (err: any) {
			error = err?.error || err?.message || 'Authentication failed';
		} finally {
			loading = false;
		}
	}

	function handleGoogleLogin() {
		window.location.href = 'http://localhost:3000/auth/google';
	}
</script>

<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4 py-8 animate-fade-in relative">
	<!-- Skip to main content link for keyboard users -->
	<a href="#auth-form" class="skip-link">Sari la formular</a>

	<!-- Theme Toggle Button (Top Right) -->
	<button
		onclick={themeStore.toggle}
		class="absolute top-4 right-4 p-3 rounded-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white dark:hover:bg-gray-800 hover:shadow-lg hover:scale-110 transition-all duration-300 ease-in-out group"
		aria-label={$themeStore === 'dark' ? 'Comută la modul luminos' : 'Comută la modul întunecat'}
		aria-pressed={$themeStore === 'dark'}
		type="button"
	>
		{#if $themeStore === 'dark'}
			<svg class="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
			</svg>
		{:else}
			<svg class="w-5 h-5 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
			</svg>
		{/if}
	</button>

	<div class="max-w-md w-full animate-slide-up">
		<!-- Logo & Title -->
		<div class="text-center mb-6 md:mb-8" role="banner">
			<div class="inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg mb-3 md:mb-4 hover:scale-110 hover:shadow-xl hover:shadow-blue-500/50 transition-all duration-300 animate-bounce-gentle" aria-hidden="true">
				<svg class="w-8 h-8 md:w-9 md:h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
				</svg>
			</div>
			<h1 class="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">MediTrack</h1>
			{#key isRegister}
				<p 
					in:fly={{ y: -10, duration: 300, easing: quintOut }}
					out:fly={{ y: 10, duration: 200, easing: quintOut }}
					class="text-sm md:text-base text-gray-600 dark:text-gray-400"
					id="auth-subtitle"
					aria-live="polite"
				>
					{isRegister ? 'Creează cont nou' : 'Bine ai revenit!'}
				</p>
			{/key}
		</div>

		<!-- Card -->
		<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 md:p-8 hover:shadow-2xl transition-shadow duration-300" role="main">
			{#if error}
			<div 
				class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm animate-shake"
				role="alert"
				aria-live="assertive"
			>
				{error}
			</div>
		{/if}

		<form onsubmit={handleSubmit} id="auth-form" aria-labelledby="auth-subtitle">
			{#if isRegister}
				<div transition:slide={{ duration: 500, easing: quintOut }} class="mb-4 md:mb-5">
					<label for="fullName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Nume complet <span aria-label="obligatoriu" class="text-red-500">*</span>
					</label>
					<input
						id="fullName"
						name="fullName"
						type="text"
						bind:value={fullName}
						required
						autocomplete="name"
						aria-required="true"
						aria-invalid={error && !fullName ? 'true' : 'false'}
						class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:scale-[1.02] transition-all duration-200 text-base"
						placeholder="Ion Popescu"
					/>
				</div>
			{/if}

			<div class="mb-4 md:mb-5">
				<label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
					Email <span aria-label="obligatoriu" class="text-red-500">*</span>
				</label>
				<input
					id="email"
					name="email"
					type="email"
					bind:value={email}
					required
					autocomplete="email"
					aria-required="true"
					aria-invalid={error && !email ? 'true' : 'false'}
					class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:scale-[1.02] transition-all duration-200 text-base"
					placeholder="email@example.com"
				/>
			</div>

			<div class="mb-4 md:mb-5">
				<label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
					Parolă <span aria-label="obligatoriu" class="text-red-500">*</span>
				</label>
				<input
					id="password"
					name="password"
					type="password"
					bind:value={password}
					required
					minlength={6}
					autocomplete={isRegister ? 'new-password' : 'current-password'}
					aria-required="true"
					aria-invalid={error && !password ? 'true' : 'false'}
					aria-describedby="password-hint"
					class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:scale-[1.02] transition-all duration-200 text-base"
					placeholder="••••••••"
				/>
				<p id="password-hint" class="sr-only">Minim 6 caractere</p>
			</div>

			<button
				type="submit"
				disabled={loading}
				aria-busy={loading}
				class="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-xl hover:from-blue-700 hover:to-blue-800 hover:shadow-xl hover:shadow-blue-500/50 hover:scale-[1.02] focus:ring-4 focus:ring-blue-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg touch-manipulation active:scale-95"
			>
				{loading ? 'Se procesează...' : isRegister ? 'Creează cont' : 'Intră în cont'}
			</button>
		</form>

		<div class="mt-5 md:mt-6">
			<div class="relative" role="separator" aria-label="sau">
				<div class="absolute inset-0 flex items-center">
					<div class="w-full border-t border-gray-200 dark:border-gray-700"></div>
				</div>
				<div class="relative flex justify-center text-sm">
					<span class="px-3 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">sau</span>
				</div>
			</div>

			<button
				type="button"
				onclick={handleGoogleLogin}
				aria-label="Continuă cu Google"
				class="mt-4 w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 py-3 px-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:shadow-lg hover:scale-[1.02] focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-700 font-medium transition-all duration-200 touch-manipulation active:scale-95"
			>
				<svg class="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
				<span class="text-sm md:text-base">Continuă cu Google</span>
			</button>
		</div>

		<div class="mt-5 md:mt-6 text-center">
			<button
				type="button"
				onclick={() => {
					isRegister = !isRegister;
					error = '';
				}}
				aria-label={isRegister ? 'Schimbă la pagina de autentificare' : 'Schimbă la pagina de înregistrare'}
				class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:scale-105 text-sm font-semibold transition-all duration-200 touch-manipulation"
			>
				{isRegister ? 'Ai deja cont? Intră în cont' : 'Nu ai cont? Creează unul'}
			</button>
		</div>
	</div>
	</div>
</div>
