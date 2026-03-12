// Service Worker — handles push notifications and click-to-open

const CACHE_NAME = 'suwayda-alert-v1';
const OFFLINE_URLS = ['/', '/index.html', '/manifest.json', '/icon.svg'];

// Install — pre-cache essential files so app works offline
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  e.waitUntil(clients.claim());
});

// Fetch — network-first for API, cache-first for static
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Never cache API calls
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Update cache with fresh response
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => {
        // Offline — serve from cache
        return caches.match(e.request).then((cached) => {
          return cached || caches.match('/');
        });
      })
  );
});

// Push notification received
self.addEventListener('push', (e) => {
  let data = {
    title: '🚨 تحذير',
    body: 'تحقق من نظام الإنذار',
    level: 'full',
  };

  try {
    if (e.data) {
      data = e.data.json();
    }
  } catch (err) {
    if (e.data) {
      data.body = e.data.text();
    }
  }

  const level = data.level || 'full';

  const options = {
    body: data.body + (data.bodyHe ? '\n' + data.bodyHe : ''),
    tag: 'suwayda-alert-' + level,
    renotify: true,
    requireInteraction: true,
    vibrate:
      level === 'full'
        ? [500, 200, 500, 200, 500, 200, 1000, 300, 500, 200, 500, 200, 500]
        : [300, 200, 300],
    silent: false,
    data: {
      url: self.registration.scope,
      level: level,
      timestamp: Date.now(),
    },
    actions: [
      {
        action: 'open',
        title: level === 'full' ? '🚨 افتح' : '⚠️ افتح',
      },
      { action: 'dismiss', title: '✓ حسناً' },
    ],
  };

  e.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click — open or focus the app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();

  if (e.action === 'dismiss') {
    return;
  }

  const urlToOpen = e.notification.data?.url || '/';

  e.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (new URL(client.url).pathname === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(urlToOpen);
      })
  );
});
