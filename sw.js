/* 글맛노트 서비스 워커
   앱 파일을 기기에 보관해 두었다가, 인터넷이 없어도 앱이 열리게 해요.
   노트 내용은 여기서 다루지 않아요. 노트는 Firebase가 기기와 서버에 따로 보관해요. */
const VERSION = 'geulmat-v1';
const SCOPE = self.registration.scope;
const SHELL = ['./', 'index.html', 'firebase-config.js', 'manifest.webmanifest',
  'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'].map(p => new URL(p, SCOPE).href);
const SDK = 'https://www.gstatic.com/firebasejs/';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const WAIT_MS = 4000;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.indexOf('geulmat-') === 0 && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 앱 파일: 인터넷이 되면 최신 파일을 받고, 느리거나 안 되면 보관해 둔 파일을 보여 줘요. */
async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  const cached = (await cache.match(req, { ignoreSearch: true })) ||
    (req.mode === 'navigate' ? await cache.match(new URL('index.html', SCOPE).href) : undefined);
  const net = fetch(req).then(res => {
    if (res && res.ok) { cache.put(req, res.clone()); return res; }
    return cached || res;
  });
  if (!cached) return net;
  return Promise.race([
    net.catch(() => cached),
    new Promise(r => setTimeout(() => r(cached), WAIT_MS))
  ]);
}

/* Firebase 라이브러리: 버전 주소가 바뀌지 않으니 한 번 받으면 계속 써요. */
async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

/* 글꼴: 보관해 둔 것을 바로 보여 주고, 뒤에서 새로 받아 둬요. */
async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; });
  if (hit) { net.catch(() => {}); return hit; }
  return net;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) { e.respondWith(networkFirst(req)); return; }
  if (req.url.indexOf(SDK) === 0) { e.respondWith(cacheFirst(req)); return; }
  if (FONT_HOSTS.indexOf(url.hostname) >= 0) { e.respondWith(staleWhileRevalidate(req)); return; }
  /* 로그인과 노트 저장 요청은 건드리지 않고 그대로 보내요. */
});
