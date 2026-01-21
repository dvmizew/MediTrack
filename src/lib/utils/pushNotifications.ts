import { api } from '$lib/api/client';

let registration: ServiceWorkerRegistration | null = null;

/**
 * Wait for service worker to be installed and activated
 */
async function waitForServiceWorkerReady(reg: ServiceWorkerRegistration, timeout: number = 3000): Promise<boolean> {
	const startTime = Date.now();
	
	while (Date.now() - startTime < timeout) {
		if (reg.active) {
			return true;
		}
		await new Promise(resolve => setTimeout(resolve, 100));
	}
	
	return true; // Continue anyway after timeout
}

/**
 * Register service worker when subscribing to push notifications
 */
async function ensureServiceWorkerReady(): Promise<ServiceWorkerRegistration | null> {
	if (registration) {
		return registration;
	}

	if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
		return null;
	}

	try {
		registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
		await waitForServiceWorkerReady(registration, 3000);
		return registration;
	} catch (error) {
		console.error('Service worker registration failed:', error);
		return null;
	}
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
	if (!('Notification' in window)) {
		return 'denied';
	}
	return Notification.permission;
}

/**
 * Check if user is currently subscribed to push notifications
 */
export async function isPushSubscribed(): Promise<boolean> {
	try {
		const registrations = await navigator.serviceWorker.getRegistrations();
		if (registrations.length === 0) {
			return false;
		}

		const reg = registrations[0];
		const subscription = await reg.pushManager.getSubscription();
		return subscription !== null;
	} catch (error) {
		console.error('Failed to check subscription:', error);
		return false;
	}
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
	if (!('Notification' in window)) {
		throw new Error('Notifications not supported');
	}

	const permission = await Notification.requestPermission();
	return permission;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(): Promise<boolean> {
	try {
		const permission = await requestNotificationPermission();
		if (permission !== 'granted') {
			throw new Error('Notification permission denied');
		}

		const reg = await ensureServiceWorkerReady();
		if (!reg) {
			throw new Error('Service worker not available');
		}

		const vapidResponse = await api.getPushVapidKey();
		const publicKey = vapidResponse?.publicKey;
		
		if (!publicKey) {
			throw new Error('VAPID public key not configured on server');
		}
		
		const applicationServerKey = urlBase64ToUint8Array(publicKey);

		const subscription = await reg.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: applicationServerKey as BufferSource
		});

		await api.subscribeToPush(subscription);

		return true;
	} catch (error) {
		console.error('Failed to subscribe to push:', error);
		throw error;
	}
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
	try {
		const registrations = await navigator.serviceWorker.getRegistrations();
		if (registrations.length === 0) {
			return true;
		}

		const reg = registrations[0];
		const subscription = await reg.pushManager.getSubscription();
		if (!subscription) {
			return true;
		}

		await subscription.unsubscribe();
		await api.unsubscribeFromPush(subscription.endpoint);

		return true;
	} catch (error) {
		console.error('Failed to unsubscribe from push:', error);
		throw error;
	}
}

/**
 * Send a test push notification (admin only)
 */
export async function sendTestPushNotification(targetUserId?: number): Promise<any> {
	try {
		const result = await api.sendTestPush(targetUserId);
		return result;
	} catch (error) {
		console.error('Failed to send test push:', error);
		throw error;
	}
}

/**
 * Get push subscription status from server
 */
export async function getPushStatus(): Promise<{ subscribed: boolean; subscriptions: any[] }> {
	try {
		const status = await api.getPushStatus();
		return status;
	} catch (error) {
		console.error('Failed to get push status:', error);
		throw error;
	}
}

/**
 * Convert VAPID key from URL-safe base64 to Uint8Array
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
