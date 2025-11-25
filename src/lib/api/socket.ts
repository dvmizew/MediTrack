import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config';
import { authStore } from '../stores/auth';
import { notificationStore } from '../stores/notifications';
import { get } from 'svelte/store';

class SocketClient {
	private socket: Socket | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;

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
				this.disconnect();
			}
		});

		this.socket.on('notification', (data) => {
			// Handle real-time notifications and dispatch to components
			console.log('Notification received:', data);
			window.dispatchEvent(new CustomEvent('notification', { detail: data }));
		});

		this.socket.on('new-message', (message) => {
			// Emit custom event for message components
			window.dispatchEvent(new CustomEvent('new-message', { detail: message }));
		});

		this.socket.on('user-typing', (userId) => {
			window.dispatchEvent(new CustomEvent('user-typing', { detail: userId }));
		});

		this.socket.on('user-stop-typing', (userId) => {
			window.dispatchEvent(new CustomEvent('user-stop-typing', { detail: userId }));
		});
	}

	disconnect() {
		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
		}
	}

	joinCollaboration(collaborationId: number) {
		this.socket?.emit('join-collaboration', collaborationId);
	}

	sendMessage(collaborationId: number, message: string) {
		this.socket?.emit('send-message', { collaborationId, message });
	}

	typing(collaborationId: number) {
		this.socket?.emit('typing', collaborationId);
	}

	stopTyping(collaborationId: number) {
		this.socket?.emit('stop-typing', collaborationId);
	}

	isConnected(): boolean {
		return this.socket?.connected || false;
	}
}

export const socketClient = new SocketClient();
