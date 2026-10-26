'use client'
import {t} from '@/lib/i18n'
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
    setBusy(true); setMessage(t("ui.069a6fab08"))
    try {
      await downloadOffline(['core', 'tahqiq', ...selected], (done, total) => setMessage(t("ui.b33ecce1c3",{p0:(done.toLocaleString('fa')),p1:(total.toLocaleString('fa'))})))
      localStorage.setItem('offline-optional-books', JSON.stringify(selected))
      setMessage(t("ui.026091c23f"))
    } catch { setMessage(t("ui.d5455de594")) }
    finally { setBusy(false) }
  }
  return <section aria-label={t("ui.995bf8fa6b")}>
    <h3 className="text-sm font-bold mb-3">{t("ui.995bf8fa6b")}</h3>
    <p className="text-xs leading-6 mb-2">{t("ui.12968b2a6b")}</p>
    {([['maqayis', t("ui.4c3a424943")], ['ishtiqaqi', t("ui.1da653b2f3")]] as const).map(([id, label]) => <label key={id} className="flex gap-2 items-center min-h-11 text-sm choice-row"><input type="checkbox" checked={selected.includes(id)} disabled={busy} onChange={event => setSelected(event.target.checked ? [...selected, id] : selected.filter(item => item !== id))} />{label}</label>)}
    <button className="chip min-h-11 px-3" disabled={busy} onClick={download}>{busy ? t("ui.80516c4adb") : t("ui.bdc6549d51")}</button>
    <p role="status" className="text-xs leading-6 mt-2">{message}</p>
  </section>
}
