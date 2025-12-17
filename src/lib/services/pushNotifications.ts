import { get } from 'svelte/store';
import { authStore } from '$lib/stores/auth';
import { API_URL } from '$lib/config';

export interface NotificationSubscription {
	endpoint: string;
	p256dh: string;
	auth: string;
}

export interface NotificationPermissionState {
	permission: NotificationPermission;
	hasSubscription: boolean;
	canRequest: boolean;
	reason?: string;
}

/**
 * Check if push notifications are supported
 */
export function isPushNotificationsSupported(): boolean {
	return (
		'serviceWorker' in navigator &&
		'PushManager' in window &&
		'Notification' in window
	);
}

/**
 * Get current notification permission state
 */
export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
	if (!isPushNotificationsSupported()) {
		return {
			permission: 'denied',
			hasSubscription: false,
			canRequest: false,
			reason: 'Browser does not support push notifications'
		};
	}

	const permission = Notification.permission;
	let hasSubscription = false;

	if (permission === 'granted' && 'serviceWorker' in navigator) {
		try {
			const registration = await navigator.serviceWorker.ready;
			const subscription = await registration.pushManager.getSubscription();
			hasSubscription = !!subscription;
		} catch (error) {
			console.error('Error checking subscription:', error);
		}
	}

	return {
		permission,
		hasSubscription,
		canRequest: permission === 'default'
	};
}

/**
 * Request notification permission from user
 * Returns true if user grants permission, false otherwise
 */
export async function requestNotificationPermission(): Promise<boolean> {
	if (!isPushNotificationsSupported()) {
		console.warn('Push notifications not supported');
		return false;
	}

	try {
		const permission = await Notification.requestPermission();
		
		if (permission === 'granted') {
			console.log('User granted notification permission');
			return true;
		} else if (permission === 'denied') {
			console.log('User denied notification permission');
			return false;
		} else {
			// dismissed
			console.log('Notification permission request dismissed');
			return false;
		}
	} catch (error) {
		console.error('Error requesting notification permission:', error);
		return false;
	}
}

/**
 * Subscribe to push notifications
 * Stores subscription in browser and syncs with backend
 */
export async function subscribeToPush(): Promise<boolean> {
	if (!isPushNotificationsSupported()) {
		console.warn('Push notifications not supported');
		return false;
	}

	if (Notification.permission !== 'granted') {
		console.warn('Notification permission not granted');
		return false;
	}

	try {
		console.log('Getting service worker registration...');
		
		// Register service worker if not already registered
		let registration = await navigator.serviceWorker.getRegistration();
		if (!registration) {
			console.log('Service worker not registered, registering now...');
			registration = await navigator.serviceWorker.register('/sw.js', {
				scope: '/'
			});
			console.log('Service worker registered:', registration.scope);
		} else {
			console.log('Service worker already registered');
		}
		
		let subscription = await registration.pushManager.getSubscription();
		console.log('Current subscription:', subscription);

		// If already subscribed, just sync with backend
		if (subscription) {
			await syncSubscriptionWithBackend(subscription);
			console.log('Already subscribed to push notifications');
			return true;
		}

		// Get VAPID public key from backend
		console.log('Fetching VAPID public key...');
		const vapidKey = await getVapidPublicKey();
		console.log('VAPID key received:', vapidKey ? 'Yes' : 'No');
		
		if (!vapidKey) {
			console.warn('VAPID public key not available');
			return false;
		}

		// Subscribe with VAPID key
		console.log('Creating push subscription...');
		subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource
		});
		console.log('Push subscription created');

		// Sync subscription with backend
		console.log('Syncing subscription with backend...');
		const synced = await syncSubscriptionWithBackend(subscription);
		
		if (synced) {
			console.log('Successfully subscribed to push notifications');
			return true;
		} else {
			console.warn('Failed to sync subscription with backend');
			// Still return true as local subscription is valid
			return true;
		}
	} catch (error: any) {
		// Push notifications require HTTPS in production
		// On localhost, they only work with HTTPS
		if (error?.name === 'AbortError' && window.location.hostname === 'localhost') {
			console.warn('Push notifications require HTTPS. In development, use production build or HTTPS localhost.');
			console.log('For development, you can use: npm run dev -- --host 0.0.0.0 with a reverse proxy');
			// Return true to allow app to continue, but notifications won't work
			return true;
		}
		console.error('Failed to subscribe to push notifications:', error);
		return false;
	}
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
	if (!isPushNotificationsSupported()) {
		return true;
	}

	try {
		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.getSubscription();

		if (!subscription) {
			return true;
		}

		// Unsubscribe locally
		await subscription.unsubscribe();

		// Notify backend
		await removeSubscriptionFromBackend(subscription);

		console.log('Successfully unsubscribed from push notifications');
		return true;
	} catch (error) {
		console.error('Failed to unsubscribe from push notifications:', error);
		return false;
	}
}

/**
 * Sync current subscription with backend
 */
export async function syncSubscriptionWithBackend(
	subscription: PushSubscription
): Promise<boolean> {
	try {
		const store = get(authStore) as any;
		const token = store?.token;
		if (!token) {
			console.warn('Not authenticated, cannot sync subscription');
			return false;
		}

		const response = await fetch(`${API_URL}/notifications/push-subscription`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			},
			body: JSON.stringify({
				endpoint: subscription.endpoint,
				auth: encodeKey(subscription.getKey('auth')),
				p256dh: encodeKey(subscription.getKey('p256dh'))
			})
		});

		if (!response.ok) {
			console.error('Failed to sync subscription with backend:', response.statusText);
			return false;
		}

		return true;
	} catch (error) {
		console.error('Error syncing subscription with backend:', error);
		return false;
	}
}

/**
 * Remove subscription from backend
 */
async function removeSubscriptionFromBackend(
	subscription: PushSubscription
): Promise<void> {
	try {
		const store = get(authStore) as any;
		const token = store?.token;
		if (!token) return;

		await fetch(`${API_URL}/notifications/push-subscription`, {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			},
			body: JSON.stringify({
				endpoint: subscription.endpoint
			})
		});
	} catch (error) {
		console.error('Error removing subscription from backend:', error);
	}
}

/**
 * Get VAPID public key from backend
 */
async function getVapidPublicKey(): Promise<string | null> {
	try {
		const response = await fetch(`${API_URL}/notifications/vapid-public-key`);
		if (!response.ok) {
			return null;
		}
		const data = await response.json();
		return data.publicKey;
	} catch (error) {
		console.error('Error fetching VAPID public key:', error);
		return null;
	}
}

/**
 * Convert base64 VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding)
		.replace(/\-/g, '+')
		.replace(/_/g, '/');

	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);

	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}

	return outputArray;
}

function encodeKey(key: ArrayBuffer | null): string {
	if (!key) return '';
	const bytes = new Uint8Array(key);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

/**
 * Initialize push notification system
 * Should be called on app startup
 */
export async function initializePushNotifications(): Promise<void> {
	if (!isPushNotificationsSupported()) {
		console.debug('Push notifications not supported on this device');
		return;
	}

	try {
		// If user already granted permission, subscribe
		if (Notification.permission === 'granted') {
			await subscribeToPush();
		}

		// Set up notification click handler through CustomEvent
		// (actual handler is in service worker)
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.addEventListener('message', (event) => {
				if (event.data?.type === 'NOTIFICATION_CLICK') {
					const url = event.data?.url || '/dashboard';
					window.location.href = url;
				}
			});
		}
	} catch (error) {
		console.error('Error initializing push notifications:', error);
	}
}

/**
 * Show local notification for testing
 * Only works in development or when tab is in focus
 */
export async function showTestNotification(
	title: string = 'Test Notification',
	options?: NotificationOptions
): Promise<void> {
	if (!isPushNotificationsSupported()) {
		alert('Push notifications not supported');
		return;
	}

	try {
		const registration = await navigator.serviceWorker.ready;
		const notifyOptions: NotificationOptions = {
			icon: '/icon-192.png',
			badge: '/icon-192.png',
			...options
		};
		await registration.showNotification(title, notifyOptions);
	} catch (error) {
		console.error('Error showing test notification:', error);
	}
}
