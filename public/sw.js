// Service Worker — handles push notifications and click-to-open

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('push', (e) => {
  let data = { title: '🚨 Alert', body: 'Check the alert system', level: 'full' };

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

  // Notification options vary by alert level
  const options = {
    body: data.body,
    icon: level === 'full' ? undefined : undefined, // no icon file needed
    badge: undefined,
    tag: 'suwayda-alert-' + level, // replaces previous same-level notif
    renotify: true,
    requireInteraction: true, // stays until dismissed
    vibrate: level === 'full'
      ? [500, 200, 500, 200, 500, 200, 1000, 300, 500, 200, 500, 200, 500]
      : [300, 200, 300],
    data: {
      url: self.registration.scope,
      level: level,
      timestamp: Date.now(),
    },
    // Show action buttons
    actions: [
      { action: 'open', title: level === 'full' ? '🚨 فتح التطبيق' : '⚠️ فتح التطبيق' },
      { action: 'dismiss', title: '✓ تم الاطلاع' },
    ],
    // Use a silent notification — we let the vibrate pattern handle it
    silent: false,
  };

  // Add Arabic/Hebrew body lines
  if (data.bodyHe) {
    options.body += '\n' + data.bodyHe;
  }

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Click handler — open or focus the app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();

  if (e.action === 'dismiss') {
    return;
  }

  const urlToOpen = e.notification.data?.url || '/';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if found
      for (const client of windowClients) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      return clients.openWindow(urlToOpen);
    })
  );
});
