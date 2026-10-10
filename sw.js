/* 自动记账本 Service Worker — 离线缓存(兼容 GitHub Pages 子路径) */
const VERSION = 'v3';
const CACHE = 'ledger-' + VERSION;
/* 全部使用相对路径,GitHub Pages 的 /repo/ 子目录下同样正确 */
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-maskable.svg',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    /* 逐个 add,单个失败不影响整体安装 */
    await Promise.all(ASSETS.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // 只接管同源资源
  /* 导航请求:网络优先(拿最新版),失败回退缓存 → 保证离线可开 */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(CACHE);
        c.put('./index.html', res.clone()).catch(() => {});
        return res;
      } catch (_) {
        const c = await caches.open(CACHE);
        return (await c.match('./index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }
  /* 静态资源:缓存优先 + 后台更新(stale-while-revalidate) */
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const cached = await c.match(req);
    const network = fetch(req).then(res => {
      if (res && res.status === 200 && res.type === 'basic') c.put(req, res.clone()).catch(() => {});
      return res;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
