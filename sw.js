/* MiniManager service worker.
   Two jobs: make the app open with no signal, and make a new release actually
   reach the phone.

   CACHE must change on every release. If it does not, browsers keep serving
   the old index.html and the release is invisible. */
const CACHE = 'minimanager-v038';
const SHELL = ['./', './index.html'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    /* cache:'reload' matters: without it the worker can fetch the shell through
       the browser's own HTTP cache and store the very copy it meant to replace. */
    await Promise.all(SHELL.map(u => c.add(new Request(u, { cache:'reload' }))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate'){
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(CACHE);
        c.put('./index.html', fresh.clone());
        return fresh;
      } catch (err){
        const cached = await caches.match('./index.html');
        if (cached) return cached;
        return new Response(
          '<!doctype html><meta charset=utf-8><title>Offline</title>' +
          '<body style="font-family:system-ui;padding:40px;text-align:center">' +
          '<h1>MiniManager is offline</h1>' +
          '<p>No stored copy was found on this phone yet. Open it once with a connection.</p>',
          { headers:{ 'content-type':'text/html; charset=utf-8' }, status:503 });
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic'){
      const c = await caches.open(CACHE);
      c.put(req, res.clone());
    }
    return res;
  })());
});
