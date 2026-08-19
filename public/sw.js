const CACHE_NAME = 'horae-ops-cache-v4';

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
      icon = '/app-icon-192.png',
      badge = '/app-icon-192.png',
      tag = 'horae-notif',
      requireInteraction = false,
      userId,          // Plan B ack fields (set by notify-dispatcher)
      tenantId,
      ackUrl
    } = data;

    // Plan B: prove this push actually reached the device. This is the only
    // reliable delivery signal — it stamps users.last_push_ack_at server-side so
    // the daily digest knows whether it must fall back to (paid) WhatsApp.
    if (userId && ackUrl) {
      fetch(ackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tenantId, tag, ackType: 'delivered' })
      }).catch(() => {});
    }

    const existing = await self.registration.getNotifications({ tag });
    let count = 1;
    let displayBody = body;
    if (existing.length > 0) {
      count = (existing[0].data?.count || 1) + 1;
      displayBody = `${count} new messages\nLatest: ${body}`;
      existing.forEach((n) => n.close());
    }

    // Keep the conversation's own title (e.g. the chat/task name) instead of
    // collapsing to a generic "Horae" — same as WhatsApp keeps the chat name
    // and just bumps the count.
    await self.registration.showNotification(title, {
      body: displayBody,
      icon,
      badge,
      tag,
      data: { url, count, userId, tenantId, ackUrl },
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

  // A tap is the strongest proof of delivery — record it as a 'seen' ack.
  const ackData = event.notification.data || {};
  if (ackData.userId && ackData.ackUrl) {
    fetch(ackData.ackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: ackData.userId, tenantId: ackData.tenantId, tag: event.notification.tag, ackType: 'seen' })
    }).catch(() => {});
  }

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
