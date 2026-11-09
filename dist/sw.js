const CACHE = 'bort-shell-v5';
const OWN_CACHES = new Set(['bort-shell-v1','bort-shell-v2','bort-shell-v3','bort-shell-v4',CACHE]);
const FILES = ['./', './index.html', './styles.css', './core.js', './report.js', './app.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const scopeUrl = new URL(self.registration.scope);
const inScope = url => url.origin === scopeUrl.origin && url.pathname.startsWith(scopeUrl.pathname);
const expectedType = url => {
  const path = url.pathname.toLowerCase();
  if (/\.m?js$/.test(path)) return /(?:javascript|ecmascript)/i;
  if (/\.css$/.test(path)) return /text\/css/i;
  if (/\.webmanifest$/.test(path)) return /(?:manifest\+json|json)/i;
  if (/\.json$/.test(path)) return /json/i;
  if (/\.svg$/.test(path)) return /image\/svg\+xml/i;
  if (/\.png$/.test(path)) return /image\/png/i;
  if (/\.html?$/.test(path) || path.endsWith('/')) return /text\/html/i;
  return null;
};
const usableResponse = (response, url) => {
  if (!response || !response.ok) return false;
  const type = expectedType(url);
  return !type || type.test(response.headers.get('content-type') || '');
};

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => OWN_CACHES.has(key) && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || !inScope(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(new Request(request, { cache: 'no-cache' })).then(response => {
      if (usableResponse(response, url)) caches.open(CACHE).then(cache => cache.put('./index.html', response.clone()));
      return response;
    }).catch(async () => {
      const cached = await caches.match('./index.html');
      return usableResponse(cached, new URL('./index.html', scopeUrl)) ? cached : Response.error();
    }));
    return;
  }

  event.respondWith(caches.open(CACHE).then(async cache => {
    try {
      const response = await fetch(new Request(request, { cache: 'no-cache' }));
      if (usableResponse(response, url)) await cache.put(request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(request);
      return usableResponse(cached, url) ? cached : Response.error();
    }
  }));
});
