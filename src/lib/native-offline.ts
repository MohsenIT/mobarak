const ORIGIN = 'https://quran-vajeh.vercel.app'
const CACHE = 'quran-native-data-v1'
const native = process.env.NEXT_PUBLIC_DESKTOP === '1'
let original: typeof fetch | undefined
export function installNativeOffline() {
  if (!native || typeof window === 'undefined' || original) return
  original = window.fetch.bind(window)
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href)
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/data/') || (init?.method || (input instanceof Request ? input.method : 'GET')) !== 'GET') return original!(input, init)
    const cache = await caches.open(CACHE).catch(() => null)
    const saved = await cache?.match(url.href)
    if (saved) return saved
    try { const local = await original!(input, init); if (local.ok) return local } catch {}
    const remote = await original!(ORIGIN + url.pathname, init)
    if (remote.ok) await cache?.put(url.href, remote.clone()).catch(() => {})
    return remote
  }) as typeof window.fetch
}
export async function downloadNativeOffline(groups: string[], progress?: (done: number, total: number) => void) {
  installNativeOffline()
  const request = original || fetch
  const response = await request(ORIGIN + '/offline-manifest.json', { cache: 'no-store' })
  if (!response.ok) throw new Error('manifest')
  const manifest = await response.json()
  const cache = await caches.open(CACHE)
  const files: {url: string; sha256: string}[] = groups.flatMap(group => manifest.groups[group] || [])
  let cursor = 0, done = 0
  const results = await Promise.allSettled(Array.from({ length: 6 }, async () => {
    while (cursor < files.length) {
      const file = files[cursor++]
      const url = new URL(file.url, window.location.origin).href
      const saved = await cache.match(url)
      if (saved?.headers.get('x-content-sha256') !== file.sha256) {
        // Compare the bundled file before downloading data already in the APK.
        let result: Response | undefined
        try {
          const local = await request(url)
          if (local.ok) {
            const bytes = await local.clone().arrayBuffer()
            const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')
            if (digest === file.sha256) result = local
          }
        } catch {}
        result ??= await request(ORIGIN + encodeURI(file.url), { cache: 'no-store' })
        if (!result.ok) throw new Error('download')
        const bytes = await result.arrayBuffer()
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')
        if (digest !== file.sha256) throw new Error('integrity')
        const headers = new Headers(result.headers)
        headers.delete('content-encoding'); headers.delete('content-length'); headers.set('x-content-sha256', digest)
        await cache.put(url, new Response(bytes, { headers }))
      }
      progress?.(++done, files.length)
    }
  }))
  if (results.some(result => result.status === 'rejected')) throw new Error('download')
}
installNativeOffline()
