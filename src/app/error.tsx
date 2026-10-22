'use client'
import { useState } from 'react'
import { refreshApplication } from '@/components/quran/UpdateSettings'

export default function ReaderError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  return <main dir="rtl" className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
    <h1 className="text-xl font-bold">بارگذاری برنامه کامل نشد</h1>
    <p>می‌توانید دوباره تلاش کنید یا نسخهٔ تازه را دریافت کنید. اطلاعات ذخیره‌شدهٔ شما حفظ می‌شود.</p>
    <div className="flex gap-3"><button className="chip min-h-11" onClick={reset}>تلاش دوباره</button><button className="chip min-h-11" disabled={busy} onClick={async () => { setBusy(true); setFailed(false); try { await refreshApplication() } catch { setBusy(false); setFailed(true) } }}>{busy ? 'در حال دریافت…' : 'دریافت نسخهٔ تازه'}</button></div>
    {failed && <p role="status">دریافت انجام نشد؛ اتصال اینترنت را بررسی کنید.</p>}
  </main>
}
