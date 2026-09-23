// Service Worker, dzialanie offline
// Strategia: najpierw siec (zeby nowa wersja wchodzila od razu), a gdy brak zasiegu, cache.
const CACHE = 'poszukujacy-rm-v2';
const FILES = ['./', './index.html', './style.css', './app.js', './manifest.json', './logo.png', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE).then(c => { try { c.put(event.request, clone); } catch (e) {} });
      return resp;
    }).catch(() => caches.match(event.request).then(c => c || caches.match('./index.html')))
  );
});
