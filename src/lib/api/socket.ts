import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config';
import { authStore } from '../stores/auth';
import { notificationStore } from '../stores/notifications';
import { notificationService } from '../services/notificationService';
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
			console.log('✓ Connected to socket server');
			this.reconnectAttempts = 0;
		});

		this.socket.on('disconnect', () => {
			console.log('✗ Disconnected from socket server');
		});

		this.socket.on('connect_error', (error) => {
			console.error('Socket connection error:', error);
			this.reconnectAttempts++;

			if (this.reconnectAttempts >= this.maxReconnectAttempts) {
				console.error('Max reconnection attempts reached');
				notificationService.error('Eroare conexiune', 'Aplicația nu se poate reconecta', 0);
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

				notificationStore.add(notification);

				// Show toast notification with appropriate type
				let toastType: 'success' | 'error' | 'warning' | 'info' = 'info';
				let sound = false;
				let duration = 4000;

				switch (data.type) {
					case 'alert':
					case 'error':
						toastType = 'error';
						sound = true;
						duration = 6000;
						break;
					case 'reminder':
					case 'warning':
						toastType = 'warning';
						sound = true;
						duration = 5000;
						break;
					case 'success':
						toastType = 'success';
						sound = true;
						duration = 4000;
						break;
					case 'chat':
					case 'message':
						toastType = 'info';
						sound = false;
						duration = 3000;
						break;
				}

				notificationService.showToast({
					type: toastType,
					title: notification.title,
					message: notification.message,
					duration: duration,
					sound: sound,
					vibrate: true
				});

				if (notificationService.getPermissionStatus() === 'granted' && data.type !== 'chat') {
					notificationService.showPushNotification({
						type: toastType,
						title: notification.title,
						message: notification.message,
						url: data.url || '/dashboard',
						tag: data.type,
						sound: sound
					});
				}

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
				// Don't show toast - chat UI will handle message display
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
			notificationService.error('Eroare server', 'A apărut o eroare în comunicarea cu serverul', 5000);
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