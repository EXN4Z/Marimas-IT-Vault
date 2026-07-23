// Service Worker buat Web Push notification Marimas ONE.
// Jalan di background browser, kepanggil walau tab/app lagi ketutup.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: 'Marimas ONE', body: event.data.text() };
  }

  const title = payload.title || 'Marimas ONE';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/logo.png',
    badge: '/logo.png',
    data: payload.data || {},
    tag: payload.tag || 'marimas-one-notif',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// pas notif diklik: fokus tab yang udah ada, atau buka tab baru ke halaman terkait
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});