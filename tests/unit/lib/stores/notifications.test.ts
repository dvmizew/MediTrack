import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { notificationStore } from '$lib/stores/notifications';
import type { Notification } from '$lib/stores/notifications';

describe('Notifications Store', () => {
	const mockNotification: Notification = {
		id: 1,
		title: 'Test Notification',
		message: 'This is a test notification',
		type: 'medication',
		isRead: false,
		createdAt: new Date().toISOString()
	};

	beforeEach(() => {
		notificationStore.set([]);
	});

	describe('Initial State', () => {
		it('should initialize with empty notifications array', () => {
			const state = get(notificationStore);
			expect(state).toEqual([]);
		});
	});

	describe('Add Notification', () => {
		it('should add a new notification', () => {
			notificationStore.add(mockNotification);
			
			const state = get(notificationStore);
			expect(state).toHaveLength(1);
			expect(state[0]).toEqual(mockNotification);
		});

		it('should add notifications to the beginning', () => {
			notificationStore.add(mockNotification);
			const notification2 = { ...mockNotification, id: 2 };
			notificationStore.add(notification2);
			
			const state = get(notificationStore);
			expect(state).toHaveLength(2);
			expect(state[0].id).toBe(2);
			expect(state[1].id).toBe(1);
		});

		it('should handle multiple notification types', () => {
			const medicNotif = { ...mockNotification, type: 'medication' as const };
			const chatNotif = { ...mockNotification, id: 2, type: 'chat' as const };
			const reminderNotif = { ...mockNotification, id: 3, type: 'reminder' as const };
			
			notificationStore.add(medicNotif);
			notificationStore.add(chatNotif);
			notificationStore.add(reminderNotif);
			
			const state = get(notificationStore);
			expect(state).toHaveLength(3);
		});
	});

	describe('Mark As Read', () => {
		beforeEach(() => {
			notificationStore.add(mockNotification);
			notificationStore.add({ ...mockNotification, id: 2 });
		});

		it('should mark single notification as read', () => {
			notificationStore.markAsRead(1);
			
			const state = get(notificationStore);
			const notification = state.find((n: Notification) => n.id === 1);
			expect(notification?.isRead).toBe(true);
		});

		it('should not mark other notifications as read', () => {
			notificationStore.markAsRead(1);
			
			const state = get(notificationStore);
			const notification2 = state.find((n: Notification) => n.id === 2);
			expect(notification2?.isRead).toBe(false);
		});

		it('should mark all notifications as read', () => {
			notificationStore.markAllAsRead();
			
			const state = get(notificationStore);
			expect(state.every((n: Notification) => n.isRead)).toBe(true);
		});
	});

	describe('Notification Types', () => {
		it('should handle medication type notifications', () => {
			const notif = { ...mockNotification, type: 'medication' as const };
			notificationStore.add(notif);
			
			const state = get(notificationStore);
			expect(state[0].type).toBe('medication');
		});

		it('should handle chat type notifications', () => {
			const notif = { ...mockNotification, type: 'chat' as const };
			notificationStore.add(notif);
			
			const state = get(notificationStore);
			expect(state[0].type).toBe('chat');
		});

		it('should handle reminder type notifications', () => {
			const notif = { ...mockNotification, type: 'reminder' as const };
			notificationStore.add(notif);
			
			const state = get(notificationStore);
			expect(state[0].type).toBe('reminder');
		});

		it('should handle invite type notifications', () => {
			const notif = { ...mockNotification, type: 'invite' as const };
			notificationStore.add(notif);
			
			const state = get(notificationStore);
			expect(state[0].type).toBe('invite');
		});

		it('should handle treatment_update type notifications', () => {
			const notif = { ...mockNotification, type: 'treatment_update' as const };
			notificationStore.add(notif);
			
			const state = get(notificationStore);
			expect(state[0].type).toBe('treatment_update');
		});

		it('should handle alert type notifications', () => {
			const notif = { ...mockNotification, type: 'alert' as const };
			notificationStore.add(notif);
			
			const state = get(notificationStore);
			expect(state[0].type).toBe('alert');
		});
	});

	describe('Store Operations', () => {
		it('should clear all notifications', () => {
			notificationStore.add(mockNotification);
			notificationStore.add({ ...mockNotification, id: 2 });
			
			notificationStore.set([]);
			
			const state = get(notificationStore);
			expect(state).toHaveLength(0);
		});

		it('should replace entire store content', () => {
			notificationStore.add(mockNotification);
			
			const newNotifications: Notification[] = [
				{ ...mockNotification, id: 10 },
				{ ...mockNotification, id: 20 }
			];
			notificationStore.set(newNotifications);
			
			const state = get(notificationStore);
			expect(state).toHaveLength(2);
			expect(state[0].id).toBe(10);
			expect(state[1].id).toBe(20);
		});
	});
});
