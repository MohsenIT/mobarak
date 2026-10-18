// Installation support only: keep site updates and Quran data on the network.
// No offline cache, so installed readers receive the same updates as browser tabs.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') event.respondWith(fetch(event.request, { cache: 'no-store' }))
})
