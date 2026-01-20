const CACHE_NAME = 'meditrack-v2';
const STATIC_CACHE = 'meditrack-static-v2';
const API_CACHE = 'meditrack-api-v2';

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
	console.log('[SW] Installing service worker...');
	event.waitUntil(
		caches.open(STATIC_CACHE)
			.then((cache) => {
				console.log('[SW] Caching static assets');
				return cache.addAll(STATIC_ASSETS);
			})
			.then(() => self.skipWaiting())
	);
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
	console.log('[SW] Activating service worker...');
	event.waitUntil(
		caches.keys()
			.then((cacheNames) => {
				return Promise.all(
					cacheNames.map((cacheName) => {
						if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
							console.log('[SW] Deleting old cache:', cacheName);
							return caches.delete(cacheName);
						}
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

	// API requests - Network first, fallback to cache
	if (url.pathname.startsWith('/api/')) {
		event.respondWith(
			fetch(request)
				.then((response) => {
					// Clone response before caching
					const responseToCache = response.clone();
					
					// Only cache successful responses
					if (response.status === 200) {
						caches.open(API_CACHE).then((cache) => {
							cache.put(request, responseToCache);
						});
					}
					
					return response;
				})
				.catch(() => {
					// If network fails, try cache
					return caches.match(request).then((response) => {
						if (response) {
							return response;
						}
						// If no cache, return offline page for navigation requests
						if (request.mode === 'navigate') {
							return caches.match('/offline.html');
						}
						return new Response('Offline', { status: 503 });
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
	console.log('[SW] Syncing offline confirmations...');
	// Implementation would use IndexedDB to store pending actions
}
