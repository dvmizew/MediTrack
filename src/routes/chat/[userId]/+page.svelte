<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { authStore, isMedic, isPacient } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import { socketClient } from '$lib/api/socket';
	import { toastStore } from '$lib/stores/notifications';
	import { sanitizeHTML } from '$lib/utils/sanitize';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

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
	let isConnected = $state(true);
	let lastMessageSent = $state<string>('');
	let showOptionsMenu = $state(false);
	let userOnline = $state(false);
	let lastSeen = $state<number | null>(null);

	$effect(() => {
		const userId = $page.params.userId;
		if (userId) {
			otherUserId = parseInt(userId);
			loadConversation();
			
			// Join/rejoin conversation room when userId changes
			if (socketClient.socket?.connected) {
				socketClient.socket.emit('join-conversation', otherUserId);
			}
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
		} else {
			isConnected = true;
		}

		// Join conversation room
		if (otherUserId) {
			socketClient.socket?.emit('join-conversation', otherUserId);
		}

		// Listen for new messages
		if (typeof window !== 'undefined') {
			window.addEventListener('new-message', handleNewMessage as EventListener);
			window.addEventListener('user-typing', handleUserTyping as EventListener);
			window.addEventListener('user-stop-typing', handleUserStopTyping as EventListener);
			window.addEventListener('user-status-change', handleUserStatusChange as EventListener);
			
			// Close dropdown on click outside
			window.addEventListener('click', handleClickOutside);
		}

		// Load initial user status
		loadUserStatus();
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('new-message', handleNewMessage as EventListener);
			window.removeEventListener('user-typing', handleUserTyping as EventListener);
			window.removeEventListener('user-stop-typing', handleUserStopTyping as EventListener);
			window.removeEventListener('user-status-change', handleUserStatusChange as EventListener);
			window.removeEventListener('click', handleClickOutside);
		}
		
		if (typingTimeout) {
			clearTimeout(typingTimeout);
		}
	});	function handleNewMessage(event: CustomEvent) {
		const message = event.detail;
		
		// Only add messages RECEIVED from the other user (not sent by me)
		// Messages I send are shown immediately via optimistic UI
		if (message.sender_id === otherUserId && message.receiver_id === $authStore.user?.userId) {
			// Check if message already exists (avoid duplicates)
			const exists = messages.some(m => m.message_id === message.message_id);
			if (!exists) {
				messages = [...messages, message];
				scrollToBottom();
				
				// Play subtle sound effect for received messages
				if (typeof Audio !== 'undefined') {
					try {
						const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt');
						audio.volume = 0.15;
						audio.play().catch(() => {});
					} catch {}
				}
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

	function handleUserStatusChange(event: CustomEvent) {
		const { userId, online, lastSeen: lastSeenTime } = event.detail;
		if (userId === otherUserId) {
			userOnline = online;
			lastSeen = lastSeenTime || null;
		}
	}

	async function loadUserStatus() {
		if (!otherUserId) return;
		
		try {
			const status = await api.getUserStatus(otherUserId);
			userOnline = status.online;
			lastSeen = status.lastSeen || null;
		} catch (error) {
			console.error('Failed to load user status:', error);
		}
	}

	function formatLastSeen(timestamp: number | null): string {
		if (!timestamp) return 'Offline';
		
		const now = Date.now();
		const diff = now - timestamp;
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (seconds < 60) return 'Last seen just now';
		if (minutes < 60) return `Last seen ${minutes}m ago`;
		if (hours < 24) return `Last seen ${hours}h ago`;
		if (days === 1) return 'Last seen yesterday';
		if (days < 7) return `Last seen ${days}d ago`;
		
		return `Last seen ${new Date(timestamp).toLocaleDateString()}`;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.dropdown-container')) {
			showOptionsMenu = false;
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
		lastMessageSent = messageText;
		newMessage = '';
		sending = true;

		// Optimistic UI - add message immediately with temporary ID
		const tempMessage = {
			message_id: `temp-${Date.now()}`,
			sender_id: $authStore.user?.userId,
			receiver_id: otherUserId,
			continut: messageText,
			timestamp_mesaj: new Date().toISOString(),
			_pending: true
		};
		messages = [...messages, tempMessage];
		scrollToBottom();

		try {
			// Send via socket for real-time delivery
			// Socket handler will save to DB and emit to receiver only
			socketClient.socket?.emit('send-message', {
				receiverId: otherUserId,
				continut: messageText
			});

			// Stop typing indicator
			socketClient.socket?.emit('stop-typing', otherUserId);

			// Wait a bit for confirmation, then remove pending status
			setTimeout(() => {
				messages = messages.map(m => 
					m.message_id === tempMessage.message_id 
						? { ...m, _pending: false }
						: m
				);
			}, 500);

			scrollToBottom();
		} catch (err: any) {
			console.error('Failed to send message:', err);
			
			// Remove temp message on error
			messages = messages.filter(m => m.message_id !== tempMessage.message_id);
			
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

	function viewTreatments() {
		showOptionsMenu = false;
		if ($isMedic) {
			goto(`/treatments?patientId=${otherUserId}`);
		} else {
			goto('/treatments');
		}
	}

	function createTreatment() {
		showOptionsMenu = false;
		goto(`/treatments/new?pacientId=${otherUserId}`);
	}	function viewProfile() {
		showOptionsMenu = false;
		// Navigate to user's profile
		goto(`/profile/${otherUserId}`);
	}

	function viewReports() {
		showOptionsMenu = false;
		if ($isMedic) {
			goto(`/admin/reports/user/${otherUserId}`);
		} else {
			goto('/dashboard');
		}
	}

	async function sendReminder() {
		showOptionsMenu = false;
		try {
			await api.sendReminder(otherUserId);
		} catch (err: any) {
			console.error('Failed to send reminder:', err);
		}
	}
</script>

{#if $authStore.isAuthenticated}
	<main class="h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden page-transition">
		<div class="h-full flex flex-col overflow-hidden w-full">
		<!-- Header - Chat Style -->
		<div class="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700 shadow-lg flex-shrink-0 z-10">
			<div class="w-full px-2 sm:px-4 md:px-6">
				<div class="flex items-center justify-between h-14 sm:h-16">
					<div class="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
						{#if otherUser}
							<!-- Back button -->
							<button
								onclick={() => goto('/chat')}
								class="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 active:scale-95 transition-all duration-200 flex-shrink-0"
								aria-label="Înapoi"
							>
								<svg class="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/>
								</svg>
							</button>
							
							<!-- User profile button -->
							<button 
								onclick={() => viewProfile()}
								class="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 hover:bg-white/10 dark:hover:bg-black/20 rounded-xl p-1.5 sm:p-2 transition-all duration-200"
							>
								<!-- Avatar with online status -->
								<div class="relative flex-shrink-0">
									<div class="w-9 h-9 sm:w-11 sm:h-11 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center shadow-lg ring-2 ring-white/50">
										<span class="text-base sm:text-lg md:text-xl font-bold bg-gradient-to-br from-blue-600 to-purple-600 bg-clip-text text-transparent">
											{otherUser.name?.charAt(0).toUpperCase() || '?'}
										</span>
									</div>
									<!-- Online status indicator -->
									<div class="absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 {userOnline ? 'bg-green-400' : 'bg-gray-400'} border-2 border-white rounded-full shadow-md"></div>
								</div>
								
								<!-- User info -->
								<div class="min-w-0 flex-1 text-left">
									<div class="flex items-center gap-1.5 sm:gap-2">
										<h2 class="font-bold text-sm sm:text-base md:text-lg text-white truncate drop-shadow-sm">{otherUser.name}</h2>
										<span class="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold rounded-full flex-shrink-0 bg-white/20 backdrop-blur-sm text-white border border-white/30">
											{otherUser.role === 'medic' ? '⚕️' : '🧑'}
											<span class="hidden xs:inline ml-0.5">{otherUser.role === 'medic' ? 'Doctor' : 'Pacient'}</span>
										</span>
									</div>
									<div class="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-white/90 mt-0.5">
										<div class={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${userOnline ? 'bg-green-300 animate-pulse' : 'bg-gray-300'} shadow-sm`}></div>
										<span class="font-medium">
											{#if isTyping}
												scrie...
											{:else if userOnline}
												Active now
											{:else}
												{formatLastSeen(lastSeen)}
											{/if}
										</span>
									</div>
								</div>
							</button>
						{:else}
							<button
								onclick={() => goto('/chat')}
								class="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 active:scale-95 transition-all duration-200 flex-shrink-0"
								aria-label="Înapoi"
							>
								<svg class="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/>
								</svg>
							</button>
						{/if}
					</div>

				<!-- Options Menu Button -->
				<div class="flex items-center gap-1 sm:gap-2 flex-shrink-0">
					{#if otherUser}
						<div class="relative dropdown-container">
							<button
								onclick={() => showOptionsMenu = !showOptionsMenu}
								class="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 dark:hover:bg-black/20 active:scale-95 transition-all duration-200 touch-manipulation"
								aria-label="Opțiuni"
							>
									<svg class="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
									</svg>
								</button>
								
								{#if showOptionsMenu}
									<div 
										transition:fly={{ y: -10, duration: 200, easing: quintOut }}
										class="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50"
									>
										<div class="py-2">
											{#if $isMedic}
												<!-- Medic Options -->
												<button
													onclick={createTreatment}
													class="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300"
												>
													<svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
													</svg>
													<span>Adaugă Tratament</span>
												</button>
												<button
													onclick={viewTreatments}
													class="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300"
												>
													<svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
													</svg>
													<span>Tratamente Active</span>
												</button>
												<button
													onclick={sendReminder}
													class="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300"
												>
													<svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
													</svg>
													<span>Trimite Reminder</span>
												</button>
												<button
													onclick={viewReports}
													class="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300"
												>
													<svg class="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
													</svg>
													<span>Rapoarte Pacient</span>
												</button>
											{:else}
												<!-- Pacient Options -->
												<button
													onclick={viewTreatments}
													class="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300"
												>
													<svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
													</svg>
													<span>Tratamentele Mele</span>
												</button>
												<button
													onclick={viewReports}
													class="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300"
												>
													<svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
												</svg>
												<span>Progresul Meu</span>
											</button>
										{/if}
									</div>
								</div>
							{/if}
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<div class="flex-1 flex flex-col overflow-hidden min-w-0">
		{#if loading}
			<div class="flex-1 flex items-center justify-center">
				<div class="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-3 sm:border-4 border-blue-500 border-t-transparent"></div>
			</div>
		{:else if error}
			<div class="flex-1 flex items-center justify-center p-3 sm:p-4">
				<div class="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-4 sm:p-6 max-w-md text-center mx-3">
					<svg class="w-10 h-10 sm:w-12 sm:h-12 text-red-600 dark:text-red-400 mx-auto mb-2 sm:mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
					</svg>
					<p class="text-sm sm:text-base text-red-800 dark:text-red-400 font-medium mb-3 sm:mb-4">{error}</p>
					<button
						onclick={() => goto('/chat')}
						class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 hover:shadow-xl hover:shadow-red-500/50 active:scale-95 sm:hover:scale-105 transition-all duration-200 touch-manipulation text-sm sm:text-base"
					>
						Înapoi la Mesaje
					</button>
				</div>
			</div>
		{:else}
			<!-- Messages Container -->
			<div 
				bind:this={messagesContainer}
				class="flex-1 overflow-y-auto overflow-x-hidden px-2 xs:px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4 w-full"
				style="overscroll-behavior: contain; -webkit-overflow-scrolling: touch;"
			>
				{#if messages.length === 0}
					<div class="text-center py-8 sm:py-12 px-4">
						<svg class="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 dark:text-gray-600 mx-auto mb-3 sm:mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
						</svg>
						<p class="text-sm sm:text-base text-gray-500 dark:text-gray-400">Niciun mesaj încă</p>
					</div>
				{:else}
					{#each messages as message (message.message_id)}
						<div class={`flex ${isMyMessage(message) ? 'justify-end' : 'justify-start'} animate-fade-in px-0.5 sm:px-1`}>
							<div class={`max-w-[85%] xs:max-w-[80%] sm:max-w-[75%] md:max-w-md lg:max-w-lg ${isMyMessage(message) ? 'order-2' : 'order-1'}`}>
								<div class={`rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-sm relative ${
									isMyMessage(message) 
											? message._pending 
												? 'bg-blue-500 text-white rounded-br-none opacity-70' 
												: 'bg-blue-600 text-white rounded-br-none'
											: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-none'
									}`}>
										<p class="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.continut}</p>
										{#if message._pending}
											<span class="absolute -bottom-1 -right-1 w-4 h-4 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center">
												<svg class="animate-spin h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24">
													<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
													<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
												</svg>
											</span>
										{/if}
									</div>
									<p class={`text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1 px-1 flex items-center gap-1 ${isMyMessage(message) ? 'justify-end' : 'justify-start'}`}>
										{#if message._pending}
											<span class="italic">Se trimite...</span>
										{:else}
											{formatTime(message.timestamp_mesaj)}
										{/if}
									</p>
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Message Input -->
			<div class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 safe-area-bottom overflow-hidden">
				<div class="w-full px-2 xs:px-3 sm:px-4 py-2 sm:py-3">
					<form onsubmit={(e) => { e.preventDefault(); sendMessage(); }} class="flex gap-1.5 sm:gap-2 items-end w-full min-w-0">
						<textarea
							bind:this={messageInput}
							bind:value={newMessage}
							oninput={handleInput}
							onkeypress={handleKeyPress}
							placeholder="Mesaj..."
							rows="1"
							class="flex-1 min-w-0 resize-none rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-2 py-2 sm:px-3 sm:py-2 text-xs sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-0 focus:outline-none transition"
							style="max-height: 100px; min-height: 36px;"
						></textarea>
						<button
							type="submit"
							disabled={!newMessage.trim() || sending}
							class="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed hover:shadow-xl hover:shadow-blue-500/50 active:scale-95 transition-all duration-200 flex items-center justify-center font-medium shadow-md touch-manipulation"
						>
							{#if sending}
								<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
							{:else}
								<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
								</svg>
							{/if}
						</button>
					</form>
				</div>
			</div>
 		{/if}
		</div>
	</div>
	</main>
{/if}
