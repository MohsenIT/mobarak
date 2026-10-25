'use client'
import {t} from '@/lib/i18n'
import { useState } from 'react'
import { refreshApplication } from '@/components/quran/UpdateSettings'

export default function ReaderError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  return <main dir="rtl" className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
    <h1 className="text-xl font-bold">{t("ui.7103ee8c2d")}</h1>
    <p>{t("ui.4aa18f2198")}</p>
    <div className="flex gap-3"><button className="chip min-h-11" onClick={reset}>{t("ui.be9b8b4f2b")}</button><button className="chip min-h-11" disabled={busy} onClick={async () => { setBusy(true); setFailed(false); try { await refreshApplication() } catch { setBusy(false); setFailed(true) } }}>{busy ? t("ui.80516c4adb") : t("ui.aae95f3554")}</button></div>
    {failed && <p role="status">{t("ui.972165231e")}</p>}
  </main>
}
