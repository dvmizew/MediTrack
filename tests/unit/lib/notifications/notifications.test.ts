import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { notificationStore } from '../../../../src/lib/stores/notifications';
import type { Notification } from '../../../../src/lib/stores/notifications';

describe('Notification Store', () => {
	const mockNotification: Notification = {
		id: 1,
		type: 'medication',
		title: 'Test Notification',
		message: 'This is a test notification',
		isRead: false,
		createdAt: new Date().toISOString(),
		referenceId: 123
	};

	beforeEach(() => {
		notificationStore.set([]);
	});

	describe('Initial State', () => {
		it('should initialize with empty array', () => {
			const notifications = get(notificationStore);
			expect(notifications).toEqual([]);
		});
	});

	describe('Add Notification', () => {
		it('should add notification to store', () => {
			notificationStore.add(mockNotification);
			
			const notifications = get(notificationStore);
			expect(notifications).toHaveLength(1);
			expect(notifications[0]).toEqual(mockNotification);
		});

		it('should add new notifications at the beginning', () => {
			const notification1: Notification = { ...mockNotification, id: 1, title: 'First' };
			const notification2: Notification = { ...mockNotification, id: 2, title: 'Second' };
			
			notificationStore.add(notification1);
			notificationStore.add(notification2);
			
			const notifications = get(notificationStore);
			expect(notifications[0].title).toBe('Second');
			expect(notifications[1].title).toBe('First');
		});

		it('should handle multiple notification types', () => {
			const types: Notification['type'][] = [
				'medication',
				'chat',
				'invite',
				'treatment_update',
				'reminder',
				'alert'
			];

			types.forEach((type, index) => {
				notificationStore.add({
					...mockNotification,
					id: index,
					type
				});
			});

			const notifications = get(notificationStore);
			expect(notifications).toHaveLength(6);
			expect(notifications.map(n => n.type)).toEqual(types.reverse());
		});
	});

	describe('Mark as Read', () => {
		it('should mark single notification as read', () => {
			notificationStore.add(mockNotification);
			notificationStore.markAsRead(mockNotification.id);
			
			const notifications = get(notificationStore);
			expect(notifications[0].isRead).toBe(true);
		});

		it('should only mark specified notification as read', () => {
			const notification1: Notification = { ...mockNotification, id: 1, isRead: false };
			const notification2: Notification = { ...mockNotification, id: 2, isRead: false };
			
			notificationStore.add(notification1);
			notificationStore.add(notification2);
			notificationStore.markAsRead(1);
			
			const notifications = get(notificationStore);
			const notif1 = notifications.find(n => n.id === 1);
			const notif2 = notifications.find(n => n.id === 2);
			
			expect(notif1?.isRead).toBe(true);
			expect(notif2?.isRead).toBe(false);
		});

		it('should not affect other notifications', () => {
			const notification1: Notification = { ...mockNotification, id: 1, title: 'First' };
			const notification2: Notification = { ...mockNotification, id: 2, title: 'Second' };
			
			notificationStore.add(notification1);
			notificationStore.add(notification2);
			notificationStore.markAsRead(1);
			
			const notifications = get(notificationStore);
			expect(notifications).toHaveLength(2);
			expect(notifications.find(n => n.id === 2)?.title).toBe('Second');
		});
	});

	describe('Mark All as Read', () => {
		it('should mark all notifications as read', () => {
			const notifications = Array.from({ length: 5 }, (_, i) => ({
				...mockNotification,
				id: i,
				isRead: false
			}));

			notifications.forEach(n => notificationStore.add(n));
			notificationStore.markAllAsRead();
			
			const allNotifications = get(notificationStore);
			expect(allNotifications.every(n => n.isRead)).toBe(true);
		});

		it('should not change read notifications', () => {
			const readNotification: Notification = { ...mockNotification, id: 1, isRead: true };
			const unreadNotification: Notification = { ...mockNotification, id: 2, isRead: false };
			
			notificationStore.add(readNotification);
			notificationStore.add(unreadNotification);
			notificationStore.markAllAsRead();
			
			const notifications = get(notificationStore);
			expect(notifications.every(n => n.isRead)).toBe(true);
		});

		it('should handle empty notification list', () => {
			notificationStore.markAllAsRead();
			
			const notifications = get(notificationStore);
			expect(notifications).toEqual([]);
		});
	});

	describe('Complex Scenarios', () => {
		it('should handle streak loss notification', () => {
			const streakLossNotification: Notification = {
				id: Date.now(),
				type: 'alert',
				title: 'Streak Pierdut',
				message: 'Ai pierdut seria de 7 zile. -35 XP penalizare.',
				isRead: false,
				createdAt: new Date().toISOString()
			};

			notificationStore.add(streakLossNotification);
			
			const notifications = get(notificationStore);
			expect(notifications[0].type).toBe('alert');
			expect(notifications[0].title).toBe('Streak Pierdut');
			expect(notifications[0].message).toContain('-35 XP');
		});

		it('should handle medication reminder notification', () => {
			const reminderNotification: Notification = {
				id: Date.now(),
				type: 'reminder',
				title: 'Reminder Doză',
				message: 'Este timpul să iei medicamentul X',
				isRead: false,
				createdAt: new Date().toISOString(),
				referenceId: 456
			};

			notificationStore.add(reminderNotification);
			
			const notifications = get(notificationStore);
			expect(notifications[0].type).toBe('reminder');
			expect(notifications[0].referenceId).toBe(456);
		});

		it('should handle chat notification', () => {
			const chatNotification: Notification = {
				id: Date.now(),
				type: 'chat',
				title: 'Mesaj Nou',
				message: 'Ai primit un mesaj de la Dr. Smith',
				isRead: false,
				createdAt: new Date().toISOString(),
				referenceId: 789
			};

			notificationStore.add(chatNotification);
			
			const notifications = get(notificationStore);
			expect(notifications[0].type).toBe('chat');
			expect(notifications[0].referenceId).toBe(789);
		});
	});

	describe('Reference IDs', () => {
		it('should preserve referenceId when marking as read', () => {
			const notification: Notification = {
				...mockNotification,
				referenceId: 999
			};

			notificationStore.add(notification);
			notificationStore.markAsRead(notification.id);
			
			const notifications = get(notificationStore);
			expect(notifications[0].referenceId).toBe(999);
		});

		it('should handle notifications without referenceId', () => {
			const notification: Notification = {
				...mockNotification,
				referenceId: undefined
			};

			notificationStore.add(notification);
			
			const notifications = get(notificationStore);
			expect(notifications[0].referenceId).toBeUndefined();
		});
	});
});
