// PWA State
let registration: ServiceWorkerRegistration | null = null;
let newWorkerAvailable = false;

export async function registerServiceWorker(): Promise<void> {
	// Disable SW in dev to avoid caching issues during development
	// SvelteKit + Vite HMR works best without SW in dev
	if (import.meta.env.DEV) {
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

		// Setup offline detection
		setupOfflineDetection();

		return;
	} catch (error) {
		console.error('✗ Service Worker registration failed:', error);
	}
}

function handleUpdateFound(): void {
	const newWorker = registration?.installing;
	if (!newWorker) return;

	newWorker.addEventListener('statechange', () => {
		if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
			// New service worker is ready
			newWorkerAvailable = true;

			// Dispatch custom event for UI to show "reload" button
			window.dispatchEvent(
				new CustomEvent('service-worker-update', {
					detail: { newWorker, registration }
				})
			);
		}
	});
}

function handleServiceWorkerMessage(event: any): void {
	const { type, data } = event.data;

	switch (type) {
		case 'CACHE_UPDATED':
			break;
		case 'OFFLINE':
			window.dispatchEvent(new CustomEvent('offline-mode', { detail: { offline: true } }));
			break;
		case 'ONLINE':
			window.dispatchEvent(new CustomEvent('offline-mode', { detail: { offline: false } }));
			break;
		default:
			break;
	}
}

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

function setupOfflineDetection(): void {
	// Initial status
	const isOnline = navigator.onLine;
	if (!isOnline) {
		window.dispatchEvent(new CustomEvent('offline-mode', { detail: { offline: true } }));
	}

	// Listen for online/offline events
	window.addEventListener('online', () => {
		window.dispatchEvent(new CustomEvent('offline-mode', { detail: { offline: false } }));
	});

	window.addEventListener('offline', () => {
		window.dispatchEvent(new CustomEvent('offline-mode', { detail: { offline: true } }));
	});
}
