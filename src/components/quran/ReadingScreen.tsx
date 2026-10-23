'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Status = 'off' | 'waiting' | 'active' | 'unavailable' | 'failed'
const ReadingScreen = createContext({ enabled: false, status: 'off' as Status, toggle: (_enabled: boolean) => {}, retry: () => {} })
const STORAGE_KEY = 'quran-keep-screen-awake'

/** Lives outside the drawer so closing settings does not release the reading lock. */
export function ReadingScreenProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState<Status>('off')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    try { setEnabled(localStorage.getItem(STORAGE_KEY) === 'true') } catch {}
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    if (!('wakeLock' in navigator)) { setStatus('unavailable'); return }
    if (!enabled) { setStatus('off'); return }
    let disposed = false
    let pending = false
    let lock: WakeLockSentinel | undefined
    async function acquire() {
      if (disposed || pending || lock || document.visibilityState !== 'visible') return
      pending = true
      setStatus('waiting')
      try {
        const acquired = await navigator.wakeLock.request('screen')
        if (disposed || document.visibilityState !== 'visible') { await acquired.release(); return }
        lock = acquired
        setStatus('active')
        acquired.addEventListener('release', () => {
          if (lock !== acquired) return
          lock = undefined
          if (!disposed) setStatus(document.visibilityState === 'visible' ? 'failed' : 'waiting')
        }, { once: true })
      } catch { if (!disposed) setStatus('failed') }
      finally { pending = false }
    }
    const visibility = () => {
      if (document.visibilityState === 'visible') void acquire()
      else {
        const previous = lock; lock = undefined
        void previous?.release().catch(() => {})
        setStatus('waiting')
      }
    }
    void acquire()
    document.addEventListener('visibilitychange', visibility)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', visibility)
      void lock?.release().catch(() => {})
    }
  }, [enabled, ready, attempt])

  const toggle = (value: boolean) => {
    setEnabled(value)
    try { localStorage.setItem(STORAGE_KEY, String(value)) } catch {}
  }
  return <ReadingScreen.Provider value={{ enabled, status, toggle, retry: () => setAttempt(value => value + 1) }}>{children}</ReadingScreen.Provider>
}

export default function ReadingScreenSettings() {
  const { enabled, status, toggle, retry } = useContext(ReadingScreen)
  return <section aria-label="روشن ماندن صفحه">
    <label className="flex items-center justify-between gap-3 min-h-11 cursor-pointer text-sm font-bold">
      روشن ماندن صفحه هنگام قرائت
      <input type="checkbox" role="switch" aria-label="روشن ماندن صفحه هنگام قرائت" checked={enabled} disabled={status === 'unavailable'} onChange={event => toggle(event.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--sage)]" />
    </label>
    <p role="status" className="text-xs leading-6 mt-1" style={{ color: 'var(--ink-soft)' }}>{status === 'unavailable' ? 'این مرورگر از روشن نگه داشتن صفحه پشتیبانی نمی‌کند.' : enabled && status === 'active' ? 'تا وقتی برنامه روی صفحه باز است، صفحه روشن می‌ماند.' : enabled && status === 'failed' ? 'روشن نگه داشتن صفحه فعال نشد؛ ممکن است دستگاه در حالت ذخیرهٔ باتری باشد.' : enabled ? 'با بازگشت به برنامه، روشن نگه داشتن صفحه دوباره فعال می‌شود.' : 'با فعال کردن این گزینه، هنگام مطالعه صفحه خودکار خاموش نمی‌شود.'}</p>
    {enabled && status === 'failed' && <button type="button" className="chip min-h-11 px-3 mt-2" onClick={retry}>تلاش دوباره</button>}
  </section>
}
