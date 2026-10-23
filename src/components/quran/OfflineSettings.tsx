'use client'
import { downloadNativeOffline } from '@/lib/native-offline'
import { useEffect, useState } from 'react'

export async function downloadOffline(groups: string[], progress?: (done: number, total: number) => void) {
  if (process.env.NEXT_PUBLIC_DESKTOP === '1') return downloadNativeOffline(groups, progress)
  if (!('serviceWorker' in navigator)) throw new Error('unavailable')
  const registration = await navigator.serviceWorker.ready
  if (!registration.active) throw new Error('unavailable')
  return new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = ({ data }) => {
      if (data.error || data.complete) {
        channel.port1.close()
        if (data.error) reject(new Error(data.error)); else resolve()
      } else progress?.(data.done, data.total)
    }
    registration.active!.postMessage({ type: 'DOWNLOAD_PACKS', groups }, [channel.port2])
  })
}

export default function OfflineSettings() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  useEffect(() => { try { setSelected(JSON.parse(localStorage.getItem('offline-optional-books') || '[]')) } catch {} }, [])
  async function download() {
    setBusy(true); setMessage('در حال آماده‌سازی…')
    try {
      await downloadOffline(['core', 'tahqiq', ...selected], (done, total) => setMessage(`دریافت فایل‌ها: ${done.toLocaleString('fa')} از ${total.toLocaleString('fa')}`))
      localStorage.setItem('offline-optional-books', JSON.stringify(selected))
      setMessage('داده‌های انتخاب‌شده برای استفادهٔ آفلاین آماده‌اند.')
    } catch { setMessage('دریافت کامل نشد؛ با اتصال اینترنت دوباره تلاش کنید. فایل‌های دریافت‌شده حفظ می‌شوند.') }
    finally { setBusy(false) }
  }
  return <section aria-label="دسترسی آفلاین">
    <h3 className="text-sm font-bold mb-3">دسترسی آفلاین</h3>
    <p className="text-xs leading-6 mb-2">قرآن، ترجمه‌ها، جست‌وجو، خلاصه‌ها و التحقیق به‌صورت پیش‌فرض دریافت می‌شوند. کتاب‌های دیگر بدون دانلود هم آنلاین در دسترس‌اند.</p>
    {([['maqayis', 'مقاییس'], ['ishtiqaqi', 'المعجم الاشتقاقی']] as const).map(([id, label]) => <label key={id} className="flex gap-2 items-center min-h-11 text-sm"><input type="checkbox" checked={selected.includes(id)} disabled={busy} onChange={event => setSelected(event.target.checked ? [...selected, id] : selected.filter(item => item !== id))} />{label}</label>)}
    <button className="chip min-h-11 px-3" disabled={busy} onClick={download}>{busy ? 'در حال دریافت…' : 'دریافت / به‌روزرسانی داده‌های آفلاین'}</button>
    <p role="status" className="text-xs leading-6 mt-2">{message}</p>
  </section>
}
