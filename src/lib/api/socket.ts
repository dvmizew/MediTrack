import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config.js';
import { authStore } from '../stores/auth.js';
import { systemNotificationStore } from '../stores/notifications.js';
import { get } from 'svelte/store';

class SocketClient {
	socket: Socket | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private lastNotificationTime: Record<string, number> = {};
	private notificationDedupeWindow = 1000; // 1 second window to dedupe similar notifications

	connect() {
		const { token } = get(authStore);

		if (!token || this.socket?.connected) {
			return;
		}

		this.socket = io(SOCKET_URL, {
			auth: { token },
			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 5000
		});

		this.socket.on('connect', () => {
			// Socket connected
			this.reconnectAttempts = 0;
		});

		this.socket.on('disconnect', () => {
			// Socket disconnected
		});

		this.socket.on('connect_error', (error) => {
			console.error('Socket connection error:', error);
			this.reconnectAttempts++;

			if (this.reconnectAttempts >= this.maxReconnectAttempts) {
				console.error('Max reconnection attempts reached');
				this.disconnect();
			}
		});

		this.socket.on('notification', (data) => {
			try {
				const dedupeKey = `${data.type}-${data.title}`;
				const lastTime = this.lastNotificationTime[dedupeKey] || 0;
				const now = Date.now();

				if (now - lastTime < this.notificationDedupeWindow) {
					return;
				}

				this.lastNotificationTime[dedupeKey] = now;

				const notification = {
					id: Date.now(),
					type: data.type || 'info',
					title: data.title || 'Notificare nouă',
					message: data.message || '',
					isRead: false,
					createdAt: new Date().toISOString(),
					referenceId: data.referenceId
				};

				systemNotificationStore.add(notification);

				// Dispatch custom event for component listeners
				if (typeof window !== 'undefined') {
					window.dispatchEvent(new CustomEvent('notification', { detail: notification }));
				}
			} catch (error) {
				console.error('Error processing notification:', error);
			}
		});
		this.socket.on('new-message', (message) => {
			try {
				// Just dispatch the message event - chat page will handle marking as read
				if (typeof window !== 'undefined') {
					window.dispatchEvent(new CustomEvent('new-message', { detail: message }));
				}
			} catch (error) {
				console.error('Error processing message:', error);
			}
		});

		this.socket.on('user-typing', (userId) => {
			try {
				if (typeof window !== 'undefined') {
					window.dispatchEvent(new CustomEvent('user-typing', { detail: userId }));
				}
			} catch (error) {
				console.error('Error dispatching user-typing event:', error);
			}
		});

		this.socket.on('user-stop-typing', (userId) => {
			try {
				if (typeof window !== 'undefined') {
					window.dispatchEvent(new CustomEvent('user-stop-typing', { detail: userId }));
				}
			} catch (error) {
				console.error('Error dispatching user-stop-typing event:', error);
			}
		});

		this.socket.on('user-status-change', (data) => {
			try {
				if (typeof window !== 'undefined') {
					window.dispatchEvent(new CustomEvent('user-status-change', { detail: data }));
				}
			} catch (error) {
				console.error('Error dispatching user-status-change event:', error);
			}
		});

		// Error handling for socket events
		this.socket.on('error', (error) => {
			console.error('Socket error:', error);
		});
	}

	disconnect() {
		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
		}
	}
	joinConversation(otherUserId: number) {
		this.socket?.emit('join-conversation', otherUserId);
	}

	sendMessage(receiverId: number, message: string) {
		this.socket?.emit('send-message', { receiverId, continut: message });
	}

	typing(otherUserId: number) {
		this.socket?.emit('typing', otherUserId);
	}

	stopTyping(otherUserId: number) {
		this.socket?.emit('stop-typing', otherUserId);
	}

	isConnected(): boolean {
		return this.socket?.connected || false;
	}
}

export const socketClient = new SocketClient();