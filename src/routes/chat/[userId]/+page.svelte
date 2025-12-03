<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import { socketClient } from '$lib/api/socket';
	import { toastStore } from '$lib/stores/notifications';

	let otherUserId = $state(0);
	let otherUser = $state<any>(null);
	let messages = $state<any[]>([]);
	let newMessage = $state('');
	let loading = $state(true);
	let sending = $state(false);
	let error = $state('');
	let messagesContainer: HTMLDivElement | undefined = $state();
	let messageInput: HTMLTextAreaElement | undefined = $state();
	let isTyping = $state(false);
	let typingTimeout: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		const userId = $page.params.userId;
		if (userId) {
			otherUserId = parseInt(userId);
			loadConversation();
		}
	});

	onMount(() => {
		if (!$authStore.isAuthenticated) {
			goto('/');
			return;
		}

		// Connect socket if not connected
		if (!socketClient.isConnected()) {
			socketClient.connect();
		}

		// Join conversation room
		if (otherUserId) {
			socketClient.socket?.emit('join-conversation', otherUserId);
		}

		// Listen for new messages
		window.addEventListener('new-message', handleNewMessage as EventListener);
		window.addEventListener('user-typing', handleUserTyping as EventListener);
		window.addEventListener('user-stop-typing', handleUserStopTyping as EventListener);
	});

	onDestroy(() => {
		window.removeEventListener('new-message', handleNewMessage as EventListener);
		window.removeEventListener('user-typing', handleUserTyping as EventListener);
		window.removeEventListener('user-stop-typing', handleUserStopTyping as EventListener);
		
		if (typingTimeout) {
			clearTimeout(typingTimeout);
		}
	});

	function handleNewMessage(event: CustomEvent) {
		const message = event.detail;
		
		// Check if message belongs to this conversation
		if (
			(message.sender_id === otherUserId && message.receiver_id === $authStore.user?.userId) ||
			(message.sender_id === $authStore.user?.userId && message.receiver_id === otherUserId)
		) {
			// Check if message already exists (avoid duplicates)
			const exists = messages.some(m => m.message_id === message.message_id);
			if (!exists) {
				messages = [...messages, message];
				scrollToBottom();
			}
		}
	}

	function handleUserTyping(event: CustomEvent) {
		const userId = event.detail;
		if (userId === otherUserId) {
			isTyping = true;
		}
	}

	function handleUserStopTyping(event: CustomEvent) {
		const userId = event.detail;
		if (userId === otherUserId) {
			isTyping = false;
		}
	}

	async function loadConversation() {
		try {
			loading = true;
			error = '';

			// Load conversation history
			const conversationData = await api.getConversation(otherUserId);
			messages = conversationData;

			// Load other user info
			const users = await api.getMyCollaborations();
			otherUser = users.find((u: any) => u.user_id === otherUserId);

			if (!otherUser) {
				error = 'Nu ai o colaborare activă cu acest utilizator';
				return;
			}

			scrollToBottom();
		} catch (err: any) {
			console.error('Failed to load conversation:', err);
			error = err.message || 'Nu s-a putut încărca conversația';
		} finally {
			loading = false;
		}
	}

	async function sendMessage() {
		if (!newMessage.trim() || sending) return;

		const messageText = newMessage.trim();
		newMessage = '';
		sending = true;

		try {
			// Send via socket for real-time delivery
			socketClient.socket?.emit('send-message', {
				receiverId: otherUserId,
				continut: messageText
			});

			// Also send via API as fallback
			await api.sendMessage({
				receiverId: otherUserId,
				continut: messageText
			});

			// Stop typing indicator
			socketClient.socket?.emit('stop-typing', otherUserId);

			scrollToBottom();
		} catch (err: any) {
			console.error('Failed to send message:', err);
			toastStore.add({
				type: 'error',
				title: 'Eroare',
				message: 'Nu s-a putut trimite mesajul',
				duration: 3000
			});
			// Restore message on error
			newMessage = messageText;
		} finally {
			sending = false;
			messageInput?.focus();
		}
	}

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}

	function handleInput() {
		// Send typing indicator
		socketClient.socket?.emit('typing', otherUserId);

		// Clear previous timeout
		if (typingTimeout) {
			clearTimeout(typingTimeout);
		}

		// Set timeout to stop typing
		typingTimeout = setTimeout(() => {
			socketClient.socket?.emit('stop-typing', otherUserId);
		}, 1000);
	}

	function scrollToBottom() {
		setTimeout(() => {
			if (messagesContainer) {
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
			}
		}, 100);
	}

	function formatTime(timestamp: string) {
		const date = new Date(timestamp);
		const now = new Date();
		const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

		if (diffInHours < 24) {
			return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
		} else if (diffInHours < 48) {
			return 'Ieri ' + date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
		} else {
			return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' }) + ' ' + 
				   date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
		}
	}

	function isMyMessage(message: any) {
		return message.sender_id === $authStore.user?.userId;
	}
</script>

{#if $authStore.isAuthenticated}
	<main class="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
		<!-- Header -->
		<div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div class="flex items-center justify-between h-16">
					<div class="flex items-center gap-4">
						<button
							onclick={() => goto('/chat')}
							class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition touch-manipulation"
							aria-label="Înapoi"
						>
							<svg class="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
							</svg>
						</button>
						
						{#if otherUser}
							<div class="flex items-center gap-3">
								<div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold shadow-md">
									{otherUser.name?.charAt(0).toUpperCase() || '?'}
								</div>
								<div>
									<h2 class="font-semibold text-gray-900 dark:text-gray-100">{otherUser.name}</h2>
									<p class="text-xs text-gray-500 dark:text-gray-400">{otherUser.email}</p>
								</div>
							</div>
						{/if}
					</div>

					{#if isTyping}
						<div class="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
							<div class="flex gap-1">
								<span class="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce" style="animation-delay: 0ms;"></span>
								<span class="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce" style="animation-delay: 150ms;"></span>
								<span class="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce" style="animation-delay: 300ms;"></span>
							</div>
							<span>Scrie...</span>
						</div>
					{/if}
				</div>
			</div>
		</div>

		{#if loading}
			<div class="flex-1 flex items-center justify-center">
				<div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
			</div>
		{:else if error}
			<div class="flex-1 flex items-center justify-center p-4">
				<div class="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-6 max-w-md text-center">
					<svg class="w-12 h-12 text-red-600 dark:text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
					</svg>
					<p class="text-red-800 dark:text-red-400 font-medium mb-4">{error}</p>
					<button
						onclick={() => goto('/chat')}
						class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
					>
						Înapoi la Mesaje
					</button>
				</div>
			</div>
		{:else}
			<!-- Messages Container -->
			<div 
				bind:this={messagesContainer}
				class="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-4xl mx-auto w-full"
			>
				{#if messages.length === 0}
					<div class="text-center py-12">
						<svg class="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
						</svg>
						<p class="text-gray-500 dark:text-gray-400">Niciun mesaj încă</p>
						<p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Începe conversația trimițând un mesaj</p>
					</div>
				{:else}
					{#each messages as message (message.message_id)}
						<div class={`flex ${isMyMessage(message) ? 'justify-end' : 'justify-start'} animate-fade-in`}>
							<div class={`max-w-xs sm:max-w-md lg:max-w-lg ${isMyMessage(message) ? 'order-2' : 'order-1'}`}>
								<div class={`rounded-2xl px-4 py-2 shadow-sm ${
									isMyMessage(message) 
										? 'bg-blue-600 text-white rounded-br-none' 
										: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-none'
								}`}>
									<p class="text-sm sm:text-base whitespace-pre-wrap break-words">{message.continut}</p>
								</div>
								<p class={`text-xs text-gray-500 dark:text-gray-400 mt-1 ${isMyMessage(message) ? 'text-right' : 'text-left'}`}>
									{formatTime(message.timestamp_mesaj)}
								</p>
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Message Input -->
			<div class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
				<div class="max-w-4xl mx-auto">
					<form onsubmit={(e) => { e.preventDefault(); sendMessage(); }} class="flex gap-3">
						<textarea
							bind:this={messageInput}
							bind:value={newMessage}
							oninput={handleInput}
							onkeypress={handleKeyPress}
							placeholder="Scrie un mesaj..."
							rows="1"
							class="flex-1 resize-none rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-0 focus:outline-none transition"
							style="max-height: 120px;"
						></textarea>
						<button
							type="submit"
							disabled={!newMessage.trim() || sending}
							class="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-500/50 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 font-medium shadow-md"
						>
							{#if sending}
								<svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
							{:else}
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
								</svg>
							{/if}
							<span class="hidden sm:inline">Trimite</span>
						</button>
					</form>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
						Apasă Enter pentru a trimite, Shift+Enter pentru linie nouă
					</p>
				</div>
			</div>
		{/if}
	</main>
{/if}
