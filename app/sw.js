/* 서비스 워커 — 오프라인으로 돌게 한다.
 *
 * 캐시 우선(cache-first)으로 두었다가 크게 데였다.
 * 새 engine.bundle.js를 올려도 옛것이 계속 나와 앱이 죽는다.
 * 그래서 **망 먼저(network-first)**로 바꾼다.
 *   - 인터넷이 되면 늘 새것을 받고, 받은 것을 캐시에 넣는다
 *   - 인터넷이 없으면 캐시에서 꺼낸다 (오프라인은 그대로 된다)
 * 정적 파일 몇 개짜리 앱이라 이쪽이 손해가 없다.
 */
const 판 = 'ganmyeong-v34';
const 자산 = ['./', './index.html', './engine.bundle.js', './manseryeok.browser.js', './mundap_ui.js', './manifest.json', './privacy.html',
              './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(판);
    try { await c.addAll(자산); } catch (err) { /* 하나 실패해도 설치는 계속 */ }
    // 접근벽·오류 페이지가 번들 자리에 캐시되는 사고를 막는다
    const r = await c.match('./engine.bundle.js');
    if (r) {
      const 머리 = (await r.clone().text()).trimStart().slice(0, 1);
      if (머리 === '<') { await caches.delete(판); throw new Error('번들이 HTML로 캐시됨 — 설치 취소'); }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== 판).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;   // 중계 서버는 건드리지 않는다
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const 복 = res.clone();
        caches.open(판).then(c => c.put(req, 복)).catch(()=>{});
      }
      return res;
    } catch (err) {
      const hit = await caches.match(req);
      return hit || caches.match('./index.html');
    }
  })());
});

// 앱이 「캐시 비우고 새로 받기」를 시킬 때
self.addEventListener('message', e => {
  if (e.data === '싹비움') caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))));
});
