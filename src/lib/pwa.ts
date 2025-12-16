import { notificationService } from './services/notificationService.js';

// PWA State
let deferredPrompt: any = null;
let registration: ServiceWorkerRegistration | null = null;
let newWorkerAvailable = false;

/**
 * Register and manage the Service Worker
 * Handles updates, offline fallback, and push notifications
 */
export async function registerServiceWorker(): Promise<void> {
	// Disable SW in dev to avoid caching issues during development
	// SvelteKit + Vite HMR works best without SW in dev
	if (import.meta.env.DEV) {
		console.info('Service Worker disabled in development mode');
		return;
	}
	if (!('serviceWorker' in navigator)) {
		console.warn('Service Workers not supported');
		return;
	}

	try {
		registration = await navigator.serviceWorker.register('/sw.js', {
			scope: '/'
		});

		console.log('✓ Service Worker registered:', registration.scope);

		// Check for updates every 60 seconds
		setInterval(async () => {
			try {
				await registration?.update();
			} catch (error) {
				console.error('Service worker update check failed:', error);
			}
		}, 60000);

		// Listen for updates
		registration.addEventListener('updatefound', handleUpdateFound);

		// Handle messages from service worker
		navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

		// Setup push notifications after registration
		await setupPushNotifications(registration);

		// Setup offline detection
		setupOfflineDetection();

		return;
	} catch (error) {
		console.error('✗ Service Worker registration failed:', error);
		notificationService.error(
			'Eroare PWA',
			'Nu s-a putut înregistra service worker',
			5000
		);
	}
}

/**
 * Handle service worker update found
 */
function handleUpdateFound(): void {
	const newWorker = registration?.installing;
	if (!newWorker) return;

	newWorker.addEventListener('statechange', () => {
		if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
			// New service worker is ready
			newWorkerAvailable = true;

			// Notify user of update
			notificationService.success(
				'Update disponibil',
				'O nouă versiune a aplicației este disponibilă',
				5000
			);

			// Dispatch custom event for UI to show "reload" button
			window.dispatchEvent(
				new CustomEvent('service-worker-update', {
					detail: { newWorker, registration }
				})
			);
		}
	});
}

/**
 * Handle messages from service worker
 */
function handleServiceWorkerMessage(event: any): void {
	const { type, data } = event.data;

	switch (type) {
		case 'CACHE_UPDATED':
			console.log('Cache updated:', data);
			break;
		case 'OFFLINE':
			console.log('App is offline');
			window.dispatchEvent(new CustomEvent('offline-mode', { detail: { offline: true } }));
			break;
		case 'ONLINE':
			console.log('App is back online');
			window.dispatchEvent(new CustomEvent('offline-mode', { detail: { offline: false } }));
			break;
		default:
			console.log('Unknown message from service worker:', type);
	}
}

/**
 * Activate a pending service worker update
 * Call this when user accepts the "new version available" prompt
 */
export async function activateNewServiceWorker(): Promise<void> {
	if (!newWorkerAvailable || !registration?.waiting) {
		console.warn('No new service worker available');
		return;
	}

	// Tell the waiting service worker to skip waiting
	registration.waiting.postMessage({ type: 'SKIP_WAITING' });

	// Listen for the controlling service worker changing
	let refreshing = false;
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (!refreshing) {
			refreshing = true;
			// Reload the page to get the new service worker
			window.location.reload();
		}
	});
}

/**
 * Setup install prompt handling
 * Listens for beforeinstallprompt event and provides methods to trigger install
 */
export function setupInstallPrompt(): void {
	window.addEventListener('beforeinstallprompt', (e: any) => {
		const event = e as any;
		// Prevent the mini-infobar from appearing
		event.preventDefault();
		// Store the event for later use
		deferredPrompt = event;

		// Update UI to show install button
		window.dispatchEvent(
			new CustomEvent('install-prompt-ready', {
				detail: { canInstall: true }
			})
		);
	});

	// When app is installed
	window.addEventListener('appinstalled', () => {
		console.log('PWA installed successfully');
		deferredPrompt = null;

		notificationService.success(
			'Instalare completă',
			'MediTrack a fost adăugat pe dispozitivul tău',
			3000
		);

		window.dispatchEvent(
			new CustomEvent('install-prompt-ready', {
				detail: { canInstall: false }
			})
		);
	});
}

/**
 * Trigger the installation prompt
 * Call this from a button click handler
 */
export async function promptForInstall(): Promise<boolean> {
	if (!deferredPrompt) {
		console.warn('Install prompt not available');
		return false;
	}

	try {
		// Show the prompt
		deferredPrompt.prompt();

		// Wait for user response
		const { outcome } = await deferredPrompt.userChoice;

		if (outcome === 'accepted') {
			console.log('User accepted install prompt');
			return true;
		} else {
			console.log('User dismissed install prompt');
			deferredPrompt = null;
			return false;
		}
	} catch (error) {
		console.error('Error triggering install prompt:', error);
		return false;
	}
}

/**
 * Check if app is installed as PWA
 */
export function isInstalledAsPWA(): boolean {
	return (
		window.matchMedia('(display-mode: standalone)').matches ||
		(window.navigator as any).standalone === true ||
		document.referrer.includes('android-app://')
	);
}

/**
 * Check if install prompt is available
 */
export function canInstall(): boolean {
	return deferredPrompt !== null;
}

/**
 * Setup push notifications after service worker registration
 */
async function setupPushNotifications(reg: ServiceWorkerRegistration): Promise<void> {
	// Check browser support
	if (!('Notification' in window) || !('serviceWorker' in navigator)) {
		console.debug('Push notifications not supported');
		return;
	}

	// Skip if user denied permission
	if (Notification.permission === 'denied') {
		console.debug('User denied push notification permission');
		return;
	}

	// If already have permission, subscribe
	if (Notification.permission === 'granted') {
		try {
			await subscribeToPushNotifications(reg);
		} catch (error) {
			console.error('Failed to subscribe to push notifications:', error);
		}
	}
}

/**
 * Subscribe to push notifications with VAPID
 */
async function subscribeToPushNotifications(
	reg: ServiceWorkerRegistration
): Promise<void> {
	try {
		// Check if already subscribed
		let subscription = await reg.pushManager.getSubscription();

		if (subscription) {
			console.log('Already subscribed to push notifications');
			return;
		}

		// Get VAPID public key
		const vapidPublicKey = process.env.PUBLIC_VAPID_PUBLIC_KEY;
		if (!vapidPublicKey) {
			console.warn('VAPID public key not configured');
			return;
		}

		// Subscribe to push notifications
		subscription = await reg.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
		});

		console.log('✓ Subscribed to push notifications');

		// Send subscription to server
		try {
			const token = localStorage.getItem('auth-token');
			if (!token) {
				console.warn('No auth token available for push subscription');
				return;
			}

			await fetch('/api/push-subscription', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify(subscription)
			});

			console.log('Push subscription synced with server');
		} catch (error) {
			console.error('Failed to sync push subscription with server:', error);
		}
	} catch (error) {
		console.error('Failed to subscribe to push notifications:', error);
	}
}

/**
 * Convert VAPID key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);

	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}

	return outputArray;
}

/**
 * Setup offline detection and handling
 */
function setupOfflineDetection(): void {
	// Initial status
	const isOnline = navigator.onLine;
	if (!isOnline) {
		window.dispatchEvent(new CustomEvent('offline-mode', { detail: { offline: true } }));
	}

	// Listen for online/offline events
	window.addEventListener('online', () => {
		console.log('App is online');
		window.dispatchEvent(new CustomEvent('offline-mode', { detail: { offline: false } }));
		notificationService.success('Conectat', 'Esti din nou conectat la internet', 2000);
	});

	window.addEventListener('offline', () => {
		console.log('App is offline');
		window.dispatchEvent(new CustomEvent('offline-mode', { detail: { offline: true } }));
		notificationService.warning('Mod offline', 'Nu esti conectat la internet', 3000);
	});
}

/**
 * Setup network detection and dispatch events
 */
export function setupNetworkDetection(): void {
	// This is now handled by setupOfflineDetection
	setupOfflineDetection();
}
