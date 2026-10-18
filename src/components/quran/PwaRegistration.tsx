'use client'
import { useEffect, useRef, useState } from 'react'

export default function PwaRegistration() {
  const [available, setAvailable] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const dismissed = useRef<string | null>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
      // Reading remains available when the browser disables installation support.
    })
    let live = true
    let pending = false
    const controller = new AbortController()
    const check = async () => {
      if (pending || document.visibilityState === 'hidden') return
      pending = true
      try {
        const response = await fetch('/api/version', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) return
        const { version } = await response.json()
        if (live && typeof version === 'string' && version && version !== process.env.NEXT_PUBLIC_APP_VERSION && version !== dismissed.current) setAvailable(version)
      } catch {
        // Offline reading should not be interrupted by update checks.
      } finally { pending = false }
    }
    void check()
    const timer = setInterval(check, 60_000)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      live = false; controller.abort(); clearInterval(timer)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  if (!available) return null
  return <div className="app-update-notice" role="status" aria-live="polite">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold">نسخهٔ جدید آماده است</p>
      <p className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>برای دریافت آخرین تغییرات، به‌روزرسانی کنید.</p>
    </div>
    <button type="button" className="app-update-button" disabled={refreshing} onClick={() => {
      setRefreshing(true)
      const url = new URL(window.location.href)
      url.searchParams.set('_refresh', Date.now().toString())
      window.location.replace(url.href)
    }}>{refreshing ? 'در حال به‌روزرسانی…' : 'به‌روزرسانی'}</button>
    <button type="button" className="icon-btn sm" aria-label="بستن اعلان به‌روزرسانی" onClick={() => {
      dismissed.current = available; setAvailable(null)
    }}>×</button>
  </div>
}
