const CACHE_NAME = 'meditrack-v3';
const STATIC_CACHE = 'meditrack-static-v3';
const MAX_CACHE_SIZE = 52428800; // 50MB limit for static cache
const CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

const STATIC_ASSETS = [
	'/',
	'/dashboard',
	'/treatments',
	'/chat',
	'/collaborations',
	'/offline.html'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(STATIC_CACHE)
			.then((cache) => {
				return cache.addAll(STATIC_ASSETS);
			})
			.then(() => self.skipWaiting())
	);
});

// Activate event - cleanup old caches and remove expired entries
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys()
			.then((cacheNames) => {
				return Promise.all(
					cacheNames.map((cacheName) => {
						// Delete old versioned caches
						if (cacheName !== STATIC_CACHE) {
							return caches.delete(cacheName);
						}
						// Clean expired entries from static cache
						return caches.open(STATIC_CACHE).then((cache) => {
							return cache.keys().then((requests) => {
								return Promise.all(
									requests.map((request) => {
										return cache.match(request).then((response) => {
											if (!response) return;
											const dateStr = response.headers.get('date');
											if (dateStr) {
												const date = new Date(dateStr).getTime();
												if (Date.now() - date > CACHE_MAX_AGE) {
													return cache.delete(request);
												}
											}
										});
									})
								);
							});
						});
					})
				);
			})
			.then(() => self.clients.claim())
	);
});

// Handle messages (e.g., skip waiting)
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
		self.clients.claim();
	}
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Skip non-GET requests
	if (request.method !== 'GET') {
		return;
	}

	// Skip non-http schemes (chrome-extension, file, etc) - they can't be cached
	if (!url.protocol.startsWith('http')) {
		return;
	}

	// API requests - Never cache, always network
	// For medical data, we must always fetch fresh from server
	if (url.pathname.startsWith('/api/')) {
		event.respondWith(
			fetch(request)
				.catch(() => {
					// If offline, return 503 Service Unavailable
					return new Response(JSON.stringify({ error: 'Offline - API unavailable' }), {
						status: 503,
						headers: { 'Content-Type': 'application/json' }
					});
				})
		);
		return;
	}

	// HTML navigations: always network-first, don't cache HTML
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request)
				.catch(() => caches.match('/offline.html'))
		);
		return;
	}

	// Static assets - Cache first, fallback to network
	event.respondWith(
		caches.match(request)
			.then((response) => {
				if (response) {
					return response;
				}
				
				return fetch(request)
					.then((response) => {
						// Don't cache non-successful responses
						if (!response || response.status !== 200) {
							return response;
						}
						
						// Clone response
						const responseToCache = response.clone();
						
						caches.open(STATIC_CACHE).then((cache) => {
							cache.put(request, responseToCache);
						});
						
						return response;
					})
					.catch(() => {
						// Offline fallback for navigation
						if (request.mode === 'navigate') {
							return caches.match('/offline.html');
						}
						return new Response('Offline', { status: 503 });
					});
			})
	);
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
	if (event.tag === 'sync-confirmations') {
		event.waitUntil(syncConfirmations());
	}
});

async function syncConfirmations() {
	// Retrieve pending confirmations from IndexedDB and sync with server
	// Implementation would use IndexedDB to store pending actions
}

// Push notification event handler
self.addEventListener('push', (event) => {
	if (!event.data) {
		return;
	}
	let data = {};
	try {
		// Firefox uneori trimite string, nu json
		try {
			data = event.data.json();
		} catch (e) {
			try {
				data = JSON.parse(event.data.text());
			} catch (e2) {
				data = { body: 'Ai o notificare nouă' };
			}
		}
		const options = {
			body: data.body || 'Ai o notificare nouă',
			icon: data.icon || '/icon-192.png',
			badge: data.badge || '/icon-192.png',
			vibrate: [200, 100, 200],
			data: {
				url: data.data && data.data.url ? data.data.url : '/dashboard',
				timestamp: data.data && data.data.timestamp ? data.data.timestamp : Date.now()
			},
			actions: [
				{
					action: 'open',
					title: 'Deschide'
				},
				{
					action: 'close',
					title: 'Închide'
				}
			]
		};
		event.waitUntil(
			self.registration.showNotification(data.title || 'MediTrack', options)
		);
	} catch (error) {
		// fallback: notificare simplă
		event.waitUntil(
			self.registration.showNotification('MediTrack', {
				body: 'Ai o notificare nouă',
				icon: '/icon-192.png',
				badge: '/icon-192.png'
			})
		);
		console.error('Push notification error:', error);
	}
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
	event.notification.close();

	if (event.action === 'close') {
		return;
	}

	const urlToOpen = event.notification.data?.url || '/dashboard';

	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true })
			.then((clientList) => {
				// Check if there's already a window open
				for (const client of clientList) {
					if (client.url.includes(urlToOpen) && 'focus' in client) {
						return client.focus();
					}
				}
				// If no window is open, open a new one
				if (clients.openWindow) {
					return clients.openWindow(urlToOpen);
				}
			})
	);
});
