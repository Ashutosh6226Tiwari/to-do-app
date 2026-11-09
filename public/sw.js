const CACHE_NAME = 'lumo-shell-v1';
const OFFLINE_URL = '/offline.html';

const APP_SHELL = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

// Domains and paths that must NEVER be cached
function shouldBypassCache(url) {
  const parsed = new URL(url);

  // Never cache backend API calls
  if (parsed.pathname.startsWith('/api/')) {
    return true;
  }

  // Never cache Firebase Auth, Firestore, Google APIs, or external streaming services
  const bypassedHosts = [
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'firebase.googleapis.com',
    'apis.google.com',
    'accounts.google.com',
    'www.googleapis.com',
  ];

  return bypassedHosts.some(
    (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        // Precache app shell resilience assets
        return cache.addAll(APP_SHELL).catch((err) => {
          console.warn('[Lumo SW] App shell precache partial failure:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') {
    return;
  }

  // Bypass cache for APIs, Firebase Auth, and Firestore
  if (shouldBypassCache(req.url)) {
    return;
  }

  // Handle SPA navigation requests (Network first -> Cache -> Offline page fallback)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(async () => {
          const cachedApp =
            (await caches.match(req)) ||
            (await caches.match('/')) ||
            (await caches.match('/index.html'));
          if (cachedApp) {
            return cachedApp;
          }
          const offlinePage = await caches.match(OFFLINE_URL);
          if (offlinePage) {
            return offlinePage;
          }
          return new Response(
            '<h1>Lumo is currently offline</h1><p>Please check your connection.</p>',
            {
              headers: { 'Content-Type': 'text/html' },
            }
          );
        })
    );
    return;
  }

  // Static assets (CSS, JS, Fonts, Images) -> Stale-While-Revalidate
  const url = new URL(req.url);
  const isStatic =
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.woff2'));

  if (isStatic) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              const clone = networkRes.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return networkRes;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Default fallback: Try network, fallback to cache
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

// Update prompt skip-waiting & System notifications
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'SHOW_TIMER_NOTIFICATION') {
    const { title, options } = event.data;
    const defaultOptions = {
      body: 'Your focus session is complete! Time for a well-earned break.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'lumo-timer-complete',
      renotify: true,
      silent: false,
    };
    self.registration.showNotification(
      title || 'Lumo — Focus Session Complete!',
      Object.assign(defaultOptions, options || {})
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow('/');
        }
      })
  );
});
