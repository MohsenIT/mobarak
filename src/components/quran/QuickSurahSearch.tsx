'use client'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { SurahMeta } from '@/lib/quran'
import { toFa } from '@/lib/quran'
import type { QuranSearchResult } from '@/lib/quran-search'
import type { SearchMode } from '@/lib/quran-search-session'
import type { SearchStart } from './QuranSearch'

export default function QuickSurahSearch({ surah, onClose, onPick, onAdvanced }: {
  surah: SurahMeta; onClose: () => void; onPick: (s: number, a: number, pos: number) => void
  onAdvanced: (start: Omit<SearchStart, 'revision'>) => void
}) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('text')
  const [results, setResults] = useState<QuranSearchResult[]>([])
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const worker = useRef<Worker | null>(null)
  const request = useRef(0)
  const pick = useRef(onPick); pick.current = onPick
  useEffect(() => { input.current?.focus(); return () => worker.current?.terminate() }, [])
  const jump = (items: QuranSearchResult[], i: number) => {
    const item = items[i]
    if (item) { setIndex(i); pick.current(item.s, item.a, item.positions[0] ?? 1) }
  }
  useEffect(() => {
    const id = ++request.current
    setError(false); setResults([]); setIndex(0)
    const value = query.trim().replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    if (/^\d+$/.test(value)) {
      const a = Number(value)
      if (a > 0 && a <= surah.vc) { const item = { s: surah.n, a, positions: [1], words: [], waw: [], parts: {}, kind: 'exact' as const, score: 0 }; setResults([item]); jump([item], 0) }
      setBusy(false); return
    }
    if (value.length < 2) { setBusy(false); return }
    setBusy(true)
    const timer = setTimeout(() => {
      try {
        if (!worker.current) {
          worker.current = new Worker(new URL('../../lib/quran-search.worker.ts', import.meta.url), { type: 'module' })
          worker.current.onmessage = (event: MessageEvent<{ id: number; results?: QuranSearchResult[]; error?: boolean }>) => {
            if (event.data.id !== request.current) return
            const items = event.data.results ?? []
            setResults(items); setBusy(false); setError(!!event.data.error); jump(items, 0)
          }
          worker.current.onerror = () => { setBusy(false); setError(true); worker.current?.terminate(); worker.current = null }
        }
        worker.current.postMessage({ id, query: value, options: { mode, includePartial: true, surahs: [surah.n] } })
      } catch { setBusy(false); setError(true) }
    }, 180)
    return () => { clearTimeout(timer); request.current++ }
  }, [query, mode, surah.n, surah.vc])
  const expand = (all: boolean) => onAdvanced({ query, mode, surahs: all ? [] : [surah.n] })
  return <div className="quick-surah-search" aria-label="جست‌وجوی سریع در سوره">
    <form onSubmit={event => { event.preventDefault(); if (results.length) jump(results, (index + 1) % results.length) }}>
      <button type="button" className="icon-btn" aria-label="بستن جست‌وجوی سریع" onClick={onClose}><ArrowRight size={20} /></button>
      <input ref={input} type="search" value={query} maxLength={160} onChange={event => setQuery(event.target.value)} aria-label="جست‌وجو در همین سوره" placeholder="واژه، عبارت یا شمارهٔ آیه…" autoComplete="off" spellCheck={false} onKeyDown={event => { if (event.key === 'Escape') onClose() }} />
      {query && <button type="button" className="icon-btn" aria-label="پاک‌کردن جست‌وجوی سریع" onClick={() => { setQuery(''); input.current?.focus() }}><X size={18} /></button>}
    </form>
    <div className="quick-search-status"><span>در سورهٔ {surah.fa}</span><span role="status" aria-live="polite">{busy ? 'در حال جست‌وجو…' : error ? 'بارگیری انجام نشد' : results.length ? `${toFa(index + 1)} از ${toFa(results.length)}` : query.trim().length >= 2 ? 'نتیجه‌ای نیست' : 'متن یا شمارهٔ آیه'}</span><button type="button" disabled={!results.length || busy} aria-label="نتیجهٔ قبلی در سوره" onClick={() => jump(results, (index - 1 + results.length) % results.length)}><ChevronRight size={18} /></button><button type="button" disabled={!results.length || busy} aria-label="نتیجهٔ بعدی در سوره" onClick={() => jump(results, (index + 1) % results.length)}><ChevronLeft size={18} /></button></div>
    <div className="quick-search-actions"><div role="group" aria-label="روش جست‌وجوی سریع">{([['text', 'متن'], ['root', 'ریشه'], ['lemma', 'بُن‌واژه']] as const).map(([key, title]) => <button type="button" key={key} aria-pressed={key === mode} onClick={() => setMode(key)}>{title}</button>)}</div><button type="button" onClick={() => expand(false)}>پیشرفته</button><button type="button" onClick={() => expand(true)}>کل قرآن ←</button></div>
  </div>
}
