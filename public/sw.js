// Always prefer the network for documents and Quran data. Keep successfully
// visited resources as a fallback when an installed app starts without a network.
const CACHE = 'quran-startup-v1'
const PACKS = 'quran-offline-packs-v1'
const SHELL = '/__last-successful-document'
const shellFor=url=>url.pathname.startsWith('/study/taha')?'/__study-taha-document':SHELL
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

const unavailable = () => new Response(`<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#faf4df"><title>قرآن مبارک</title><body style="margin:0;background:#faf4df;color:#0e2a22;font-family:system-ui;display:grid;place-content:center;min-height:100dvh;text-align:center;padding:0 24px;box-sizing:border-box"><h1>قرآن مبارک</h1><p>اتصال برقرار نشد. دوباره تلاش کنید.</p><button onclick="location.reload()" style="font:inherit;padding:12px;border:1px solid #0e2a22;border-radius:12px;background:transparent;color:inherit">تلاش دوباره</button></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  const navigation = request.mode === 'navigate'
  const asset = url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/data/') || url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/images/')
  if (!navigation && !asset) return
  event.respondWith((async () => {
    let cache
    try { cache = await caches.open(CACHE) } catch { /* Storage may be unavailable. */ }
    const packs = await caches.open(PACKS).catch(() => null)
    const packed = packs && await packs.match(request)
    if (packed) return packed
    // Content-hashed bundles are immutable, including those used by a saved page.
    if (url.pathname.startsWith('/_next/static/') && cache) {
      const saved = await cache.match(request)
      if (saved) return saved
    }
    try {
      const response = await fetch(request, navigation ? { cache: 'no-store' } : undefined)
      if (navigation && response.status >= 500) throw new Error('Navigation unavailable')
      if (response.ok && cache) {
        try { await cache.put(navigation ? shellFor(url) : request, response.clone()) } catch { /* Quota must not interrupt reading. */ }
      }
      return response
    } catch (error) {
      const saved = cache && await cache.match(navigation ? shellFor(url) : request)
      if (saved) return saved
      if (navigation) return unavailable()
      throw error
    }
  })())
})

// Each verified file is committed independently, so interrupted downloads resume.
let syncing = Promise.resolve()
self.addEventListener('message', event => {
  if (event.data?.type !== 'DOWNLOAD_PACKS') return
  const port = event.ports[0]
  const task = syncing.then(async () => {
    const response = await fetch('/offline-manifest.json', { cache: 'no-store' })
    if (!response.ok) throw new Error('manifest')
    const manifest = await response.json()
    const cache = await caches.open(PACKS)
    const files = event.data.groups.flatMap(group => manifest.groups[group] || [])
    let done = 0, cursor = 0
    const results = await Promise.allSettled(Array.from({ length: 6 }, async () => {
      while (cursor < files.length) {
        const file = files[cursor++]
        const url = new URL(file.url, self.location.origin).href
        const saved = await cache.match(url)
        if (saved?.headers.get('x-content-sha256') !== file.sha256) {
          const result = await fetch(url, { cache: 'no-store' })
          if (!result.ok) throw new Error('download')
          const bytes = await result.arrayBuffer()
          const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')
          if (digest !== file.sha256) throw new Error('integrity')
          const headers = new Headers(result.headers)
          headers.delete('content-encoding'); headers.delete('content-length')
          headers.set('x-content-sha256', digest)
          await cache.put(url, new Response(bytes, { headers }))
        }
        port?.postMessage({ done: ++done, total: files.length })
      }
    }))
    if (results.some(result => result.status === 'rejected')) throw new Error('download')
    port?.postMessage({ complete: true, total: files.length })
  }).catch(() => port?.postMessage({ error: 'download' }))
  syncing = task
  event.waitUntil(task)
})

// First visits may finish loading before this worker controls the document.
// Preserve that reader shell and the UI chunks already loaded by its selected locale.
self.addEventListener('message',event=>{
  if(event.data?.type!=='CACHE_READER')return
  event.waitUntil((async()=>{
    const documentUrl=new URL(event.data.document,self.location.origin)
    if(documentUrl.origin!==self.location.origin)return
    const cache=await caches.open(CACHE)
    const response=await fetch(documentUrl.href,{cache:'no-store'})
    if(response.ok&&response.headers.get('content-type')?.includes('text/html'))await cache.put(shellFor(documentUrl),response)
    const assets=[...new Set(Array.isArray(event.data.assets)?event.data.assets:[])].slice(0,150)
    await Promise.allSettled(assets.map(async value=>{
      const url=new URL(value,self.location.origin)
      if(url.origin!==self.location.origin||!url.pathname.startsWith('/_next/static/'))return
      if(await cache.match(url.href))return
      const response=await fetch(url.href)
      if(response.ok)await cache.put(url.href,response)
    }))
  })().catch(()=>{}))
})
