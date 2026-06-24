const CACHE_NAME = 'horae-ops-cache-v2';

// ---------- INSTALL ----------
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

// ---------- ACTIVATE ----------
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
    )
  );
  self.clients.claim();
});

// ---------- FETCH (network-first, cache fallback) ----------
self.addEventListener('fetch', (e) => {
  if (
    e.request.method !== 'GET' ||
    !e.request.url.startsWith('http') ||
    e.request.url.includes('/rest/v1/')
  ) return;

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});

// ---------- FCM PUSH NOTIFICATIONS ----------
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Horae', body: event.data ? event.data.text() : 'You have a new notification.' };
  }

  const {
    title = 'Horae Notification',
    body = 'Tap to open Horae.',
    url = '/',
    icon = '/horae-logo.jpg',
    badge = '/horae-logo.jpg',
    tag,
    requireInteraction = false
  } = data;

  const options = {
    body,
    icon,
    badge,
    tag: tag || 'horae-notif-' + Date.now(),
    data: { url },
    requireInteraction,
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: '📂 Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ---------- NOTIFICATION CLICK (Deep Link Handler) ----------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If Horae PWA is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url: targetUrl });
          return;
        }
      }
      // Otherwise open a new PWA window at the deep link URL
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ---------- BACKGROUND SYNC (optional future use) ----------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
