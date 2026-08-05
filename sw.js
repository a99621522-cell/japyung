/* 서비스 워커 — 오프라인으로 돌게 한다.
   이 앱은 서버로 아무것도 보내지 않으므로, 한 번 받으면 계속 쓸 수 있어야 한다. */
const 판 = 'ganmyeong-v1';
const 자산 = ['./', './index.html', './engine.bundle.js', './manifest.json',
              './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(판).then(c => c.addAll(자산)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== 판).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin)
        caches.open(판).then(c => c.put(e.request, res.clone()));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
