'use client'
import {t} from '@/lib/i18n'

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
  return <section aria-label={t("ui.bc757e524c")}>
    <label className="flex items-center justify-between gap-3 min-h-11 cursor-pointer text-sm font-bold">{t("ui.ddebea947c")}<input type="checkbox" role="switch" aria-label={t("ui.ddebea947c")} checked={enabled} disabled={status === 'unavailable'} onChange={event => toggle(event.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--sage)]" />
    </label>
    <p role="status" className="text-xs leading-6 mt-1" style={{ color: 'var(--ink-soft)' }}>{status === 'unavailable' ? t("ui.8cd5f86a69") : enabled && status === 'active' ? t("ui.763063cda7") : enabled && status === 'failed' ? t("ui.cd46e86ad5") : enabled ? t("ui.b5cbc3b789") : t("ui.8b1995cbd5")}</p>
    {enabled && status === 'failed' && <button type="button" className="chip min-h-11 px-3 mt-2" onClick={retry}>{t("ui.be9b8b4f2b")}</button>}
  </section>
}
