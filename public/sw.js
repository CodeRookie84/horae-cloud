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
// WhatsApp-style grouping: notifications sharing a tag collapse into ONE
// notification with a running count + latest preview, instead of stacking
// as separate entries in the notification tray.
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
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
      tag = 'horae-notif',
      requireInteraction = false
    } = data;

    const existing = await self.registration.getNotifications({ tag });
    let count = 1;
    let displayBody = body;
    if (existing.length > 0) {
      count = (existing[0].data?.count || 1) + 1;
      displayBody = `${count} new alerts from Horae\nLatest: ${body}`;
      existing.forEach((n) => n.close());
    }

    await self.registration.showNotification(count > 1 ? 'Horae' : title, {
      body: displayBody,
      icon,
      badge,
      tag,
      data: { url, count },
      requireInteraction,
      vibrate: [200, 100, 200],
      actions: [
        { action: 'open', title: '📂 Open' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    });
  })());
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
