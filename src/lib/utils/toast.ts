import { getNotificationsContext } from 'svelte-notifications';

let notificationsContext: ReturnType<typeof getNotificationsContext> | null = null;

export function initToast() {
	if (typeof window !== 'undefined') {
		notificationsContext = getNotificationsContext();
	}
}

export const toast = {
	success: (text: string, removeAfter = 3000) => {
		notificationsContext?.addNotification({
			text,
			position: 'bottom-right',
			type: 'success',
			removeAfter
		});
	},
	error: (text: string, removeAfter = 4000) => {
		notificationsContext?.addNotification({
			text,
			position: 'bottom-right',
			type: 'danger',
			removeAfter
		});
	},
	warning: (text: string, removeAfter = 3500) => {
		notificationsContext?.addNotification({
			text,
			position: 'bottom-right',
			type: 'warning',
			removeAfter
		});
	},
	info: (text: string, removeAfter = 3000) => {
		notificationsContext?.addNotification({
			text,
			position: 'bottom-right',
			type: 'info',
			removeAfter
		});
	}
};
