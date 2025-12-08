import { writable } from 'svelte/store';

export interface Notification {
	id: number;
	type: 'medication' | 'chat' | 'invite' | 'treatment_update' | 'reminder' | 'alert';
	title: string;
	message: string;
	isRead: boolean;
	createdAt: string;
	referenceId?: number;
}

export interface Toast {
	id: number;
	type: 'success' | 'error' | 'warning' | 'info';
	title: string;
	message: string;
	duration?: number;
}

function createNotificationStore() {
	const { subscribe, set, update } = writable<Notification[]>([]);

	return {
		subscribe,
		set,
		add: (notification: Notification) => {
			update((notifications) => [notification, ...notifications]);
		},
		markAsRead: (id: number) => {
			update((notifications) =>
				notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n))
			);
		},
		markAllAsRead: () => {
			update((notifications) => notifications.map((n) => ({ ...n, isRead: true })));
		}
	};
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);
	let idCounter = 0;

	return {
		subscribe,
		add: (toast: Omit<Toast, 'id'>) => {
			const id = ++idCounter;
			const newToast = { ...toast, id };
			update((toasts) => [...toasts, newToast]);

			const duration = toast.duration ?? 5000;
			if (duration > 0) {
				setTimeout(() => {
					update((toasts) => toasts.filter((t) => t.id !== id));
				}, duration);
			}

			return id;
		},
		remove: (id: number) => {
			update((toasts) => toasts.filter((t) => t.id !== id));
		},
		success: (title: string, message: string, duration?: number) => {
			return toastStore.add({ type: 'success', title, message, duration });
		},
		error: (title: string, message: string, duration?: number) => {
			return toastStore.add({ type: 'error', title, message, duration });
		},
		warning: (title: string, message: string, duration?: number) => {
			return toastStore.add({ type: 'warning', title, message, duration });
		},
		info: (title: string, message: string, duration?: number) => {
			return toastStore.add({ type: 'info', title, message, duration });
		}
	};
}

export const notificationStore = createNotificationStore();
export const toastStore = createToastStore();
