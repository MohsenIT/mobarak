// Always prefer the network for documents and Quran data. Keep successfully
// visited resources as a fallback when an installed app starts without a network.
const CACHE = 'quran-startup-v1'
const SHELL = '/__last-successful-document'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

const unavailable = () => new Response(`<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#faf4df"><title>قرآن مبارک</title><body style="margin:0;background:#faf4df;color:#0e2a22;font-family:system-ui;display:grid;place-content:center;min-height:100dvh;text-align:center;padding:0 24px;box-sizing:border-box"><h1>قرآن مبارک</h1><p>اتصال برقرار نشد. دوباره تلاش کنید.</p><button onclick="location.reload()" style="font:inherit;padding:12px;border:1px solid #0e2a22;border-radius:12px;background:transparent;color:inherit">تلاش دوباره</button></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  const navigation = request.mode === 'navigate'
  const asset = url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/data/') || url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/icons/')
  if (!navigation && !asset) return
  event.respondWith((async () => {
    let cache
    try { cache = await caches.open(CACHE) } catch { /* Storage may be unavailable. */ }
    // Content-hashed bundles are immutable, including those used by a saved page.
    if (url.pathname.startsWith('/_next/static/') && cache) {
      const saved = await cache.match(request)
      if (saved) return saved
    }
    try {
      const response = await fetch(request, navigation ? { cache: 'no-store' } : undefined)
      if (navigation && response.status >= 500) throw new Error('Navigation unavailable')
      if (response.ok && cache) {
        try { await cache.put(navigation ? SHELL : request, response.clone()) } catch { /* Quota must not interrupt reading. */ }
      }
      return response
    } catch (error) {
      const saved = cache && await cache.match(navigation ? SHELL : request)
      if (saved) return saved
      if (navigation) return unavailable()
      throw error
    }
  })())
})
