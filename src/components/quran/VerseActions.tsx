'use client'

import { useState } from 'react'
import { Copy, Link, Share2 } from 'lucide-react'
import type { SurahData, Verse } from '@/lib/quran'
import { toFa } from '@/lib/quran'

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return } catch { /* Older browsers may require the selection fallback. */ }
  }
  const active = document.activeElement as HTMLElement | null
  const field = document.createElement('textarea')
  field.value = text
  field.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
  field.setAttribute('readonly', '')
  document.body.append(field)
  field.select()
  const copied = document.execCommand('copy')
  field.remove()
  active?.focus({ preventScroll: true })
  if (!copied) throw new Error('copy unavailable')
}

export default function VerseActions({ surah, verse, translation }: { surah: SurahData; verse: Verse; translation?: string }) {
  const [status, setStatus] = useState('')
  const reference = `سورهٔ ${surah.fa}، آیهٔ ${toFa(verse.n)}`
  // Preserve the source text, including connected prefixes and Quranic signs.
  const arabic = verse.w.map(word => word.t).join(' ')
  const link = () => { const url = new URL(process.env.NEXT_PUBLIC_DESKTOP === '1' ? 'https://quran-vajeh.vercel.app/' : window.location.href); url.search = new URLSearchParams({ s: String(surah.n), a: String(verse.n) }).toString(); url.hash = ''; return url.href }
  const copy = async (text: string, message: string) => {
    try { await copyText(text); setStatus(message) } catch { setStatus('کپی انجام نشد؛ دوباره تلاش کنید.') }
  }
  const share = async () => {
    const url = link()
    if (navigator.share) {
      try { await navigator.share({ title: reference, url }); setStatus('لینک به اشتراک گذاشته شد.'); return }
      catch (error) { if (error instanceof Error && error.name === 'AbortError') return }
    }
    await copy(url, 'لینک آیه کپی شد.')
  }
  return <div className="verse-actions" key={`${surah.n}:${verse.n}`}>
    <div className="flex flex-wrap gap-2" role="group" aria-label="کپی و اشتراک‌گذاری آیه">
      <button className="chip inline-flex items-center gap-1.5 min-h-11" onClick={share}><Share2 size={16} aria-hidden="true" />اشتراک لینک</button>
      <button className="chip inline-flex items-center gap-1.5 min-h-11" onClick={() => copy(link(), 'لینک آیه کپی شد.')}><Link size={16} aria-hidden="true" />کپی لینک</button>
      <button className="chip inline-flex items-center gap-1.5 min-h-11" onClick={() => copy(`${arabic}\n\n${reference}`, 'متن آیه کپی شد.')}><Copy size={16} aria-hidden="true" />کپی آیه</button>
      <button className="chip inline-flex items-center gap-1.5 min-h-11" disabled={!translation} onClick={() => copy(`${arabic}\n\n${translation}\n\n${reference}`, 'آیه همراه ترجمه کپی شد.')}><Copy size={16} aria-hidden="true" />کپی با ترجمه</button>
    </div>
    <p role="status" className="text-xs mt-2" style={{ color: 'var(--ink-soft)', minHeight: '1.25rem' }}>{status}</p>
  </div>
}
