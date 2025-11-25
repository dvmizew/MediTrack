import { writable } from 'svelte/store';

export interface Notification {
	id: number;
	type: 'medication' | 'chat' | 'invite' | 'treatment_update';
	title: string;
	message: string;
	isRead: boolean;
	createdAt: string;
	referenceId?: number;
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

export const notificationStore = createNotificationStore();
