export function registerServiceWorker() {
	if ('serviceWorker' in navigator) {
		window.addEventListener('load', async () => {
			try {
				const registration = await navigator.serviceWorker.register('/sw.js', {
					scope: '/'
				});
				
				console.log('Service Worker registered:', registration.scope);
				setupPushNotifications(registration);
				
				setInterval(() => {
					registration.update();
				}, 60000);
				
				registration.addEventListener('updatefound', () => {
					const newWorker = registration.installing;
					
					if (newWorker) {
						newWorker.addEventListener('statechange', () => {
							if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
								const event = new CustomEvent('service-worker-update', {
									detail: { newWorker }
								});
								window.dispatchEvent(event);
							}
						});
					}
				});
			} catch (error) {
				console.error('Service Worker registration failed:', error);
			}
		});
	}
}

/**
 * Setup push notifications after service worker registration
 */
function setupPushNotifications(registration: ServiceWorkerRegistration) {
	// Check if notifications are supported
	if (!('Notification' in window) || !('serviceWorker' in navigator)) {
		console.debug('Push notifications not supported');
		return;
	}

	if (Notification.permission === 'granted') {
		subscribeToPushNotifications(registration);
	}
}

async function subscribeToPushNotifications(registration: ServiceWorkerRegistration) {
	try {
		let subscription = await registration.pushManager.getSubscription();
		
		if (subscription) {
			console.log('Already subscribed to push notifications');
			return;
		}

		const vapidPublicKey = process.env.PUBLIC_VAPID_PUBLIC_KEY;
		if (!vapidPublicKey) {
			console.warn('VAPID public key not configured');
			return;
		}

		subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
		});

		console.log('Subscribed to push notifications');

		try {
			await fetch('/api/push-subscription', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
				},
				body: JSON.stringify(subscription)
			});
		} catch (error) {
			console.debug('Could not sync push subscription with server:', error);
		}
	} catch (error) {
		console.error('Failed to subscribe to push notifications:', error);
	}
}

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

let deferredPrompt: any = null;

export function setupInstallPrompt() {
	window.addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		deferredPrompt = e;
		const installButton = document.getElementById('install-button');
		if (installButton) {
			installButton.style.display = 'block';
		}
	});
	
	window.addEventListener('appinstalled', () => {
		console.log('PWA installed successfully');
		deferredPrompt = null;
	});
}

export async function promptInstall() {
	if (!deferredPrompt) {
		return false;
	}
	
	deferredPrompt.prompt();
	const { outcome } = await deferredPrompt.userChoice;
	console.log(`Install prompt ${outcome}`);
	deferredPrompt = null;
	return outcome === 'accepted';
}

export function isInstalled() {
	return window.matchMedia('(display-mode: standalone)').matches ||
		(window.navigator as any).standalone === true;
}

export function setupNetworkDetection() {
	window.addEventListener('online', () => {
		console.log('App is online');
		const event = new CustomEvent('network-status', { detail: { online: true } });
		window.dispatchEvent(event);
	});
	
	window.addEventListener('offline', () => {
		console.log('App is offline');
		const event = new CustomEvent('network-status', { detail: { online: false } });
		window.dispatchEvent(event);
	});
}
