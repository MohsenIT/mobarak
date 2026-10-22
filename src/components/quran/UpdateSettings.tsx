'use client'
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

export function refreshApplication() {
  const url = new URL(window.location.href)
  url.searchParams.set('_refresh', Date.now().toString())
  window.location.replace(url.href)
}

export default function UpdateSettings() {
  const [state, setState] = useState<'idle' | 'checking' | 'latest' | 'available' | 'error' | 'refreshing'>('idle')
  const check = async () => {
    setState('checking')
    try {
      const response = await fetch('/api/version', { cache: 'no-store', signal: AbortSignal.timeout(10000) })
      if (!response.ok) throw new Error('version')
      const { version } = await response.json()
      if (typeof version !== 'string' || !version) throw new Error('version')
      setState(version === process.env.NEXT_PUBLIC_APP_VERSION ? 'latest' : 'available')
    } catch { setState('error') }
  }
  return <section aria-label="به‌روزرسانی برنامه">
    <h3 className="text-sm font-bold mb-3">به‌روزرسانی برنامه</h3>
    {process.env.NEXT_PUBLIC_DESKTOP === '1' ? <a className="chip inline-flex min-h-11 items-center" href="https://github.com/MohsenIT/quran-vajeh/releases/latest" target="_blank" rel="noreferrer">دریافت نسخهٔ جدید</a> : <>
      <button className="chip inline-flex min-h-11 items-center gap-2" disabled={state === 'checking' || state === 'refreshing'} onClick={state === 'available' ? () => { setState('refreshing'); refreshApplication() } : check}><RefreshCw size={16} className={state === 'checking' || state === 'refreshing' ? 'animate-spin' : ''} />{state === 'checking' ? 'در حال بررسی…' : state === 'available' ? 'دریافت نسخهٔ جدید' : state === 'refreshing' ? 'در حال به‌روزرسانی…' : 'بررسی به‌روزرسانی'}</button>
      <p role="status" className="text-xs leading-6 mt-2" style={{ color: 'var(--ink-soft)' }}>{state === 'latest' ? 'برنامه به‌روز است.' : state === 'available' ? 'نسخهٔ جدید آمادهٔ دریافت است.' : state === 'error' ? 'بررسی انجام نشد؛ اتصال اینترنت را بررسی و دوباره تلاش کنید.' : ''}</p>
    </>}
  </section>
}
