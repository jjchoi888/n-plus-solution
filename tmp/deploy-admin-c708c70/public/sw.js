const SW_VERSION = 'v3_force_renotify';

self.addEventListener('install', (e) => {
  console.log('[Service Worker] Installed');
  self.skipWaiting(); // 새 버전 즉시 적용
});

self.addEventListener('activate', (e) => {
  console.log('[Service Worker] Activated');
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => { });

self.addEventListener('push', function (event) {
  let data = {};
  if (event.data) {
    try { data = event.data.json(); }
    catch (e) { data = { title: 'PMS Alert', body: event.data.text() }; }
  }

  const options = {
    body: data.body || 'You have a new task.',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [1000, 500, 1000, 500, 1000], // 징~ 징~ 징~
    requireInteraction: true,

    // 🚨 [가장 핵심] 크롬의 스팸 무음 필터를 뚫고 무조건 울리게 만드는 마법의 옵션!
    renotify: true,
    tag: 'hk-urgent-alert', // renotify를 쓰려면 반드시 태그 이름이 필요함

    data: { url: data.url || '/' }
  };

  event.waitUntil(self.registration.showNotification(data.title || '🚨 URGENT TASK', options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        if (windowClients[i].url === urlToOpen) return windowClients[i].focus();
      }
      return clients.openWindow(urlToOpen);
    })
  );
});