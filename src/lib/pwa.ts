// Service Worker registration hook
export function registerServiceWorker() {
	if ('serviceWorker' in navigator) {
		window.addEventListener('load', async () => {
			try {
				const registration = await navigator.serviceWorker.register('/sw.js', {
					scope: '/'
				});
				
				console.log('Service Worker registered:', registration.scope);
				
				// Check for updates periodically
				setInterval(() => {
					registration.update();
				}, 60000); // Check every minute
				
				// Handle updates
				registration.addEventListener('updatefound', () => {
					const newWorker = registration.installing;
					
					if (newWorker) {
						newWorker.addEventListener('statechange', () => {
							if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
								// New service worker available
								if (confirm('O versiune nouă este disponibilă. Actualizezi acum?')) {
									newWorker.postMessage({ type: 'SKIP_WAITING' });
									window.location.reload();
								}
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

// Install prompt handler
let deferredPrompt: any = null;

export function setupInstallPrompt() {
	window.addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		deferredPrompt = e;
		// Show install button
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

// Check if app is installed
export function isInstalled() {
	return window.matchMedia('(display-mode: standalone)').matches ||
		(window.navigator as any).standalone === true;
}

// Network status detection
export function setupNetworkDetection() {
	window.addEventListener('online', () => {
		console.log('App is online');
		// Show online toast notification
		const event = new CustomEvent('network-status', { detail: { online: true } });
		window.dispatchEvent(event);
	});
	
	window.addEventListener('offline', () => {
		console.log('App is offline');
		// Show offline toast notification
		const event = new CustomEvent('network-status', { detail: { online: false } });
		window.dispatchEvent(event);
	});
}
