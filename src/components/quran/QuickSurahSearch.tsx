'use client'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { searchDestinations, isNavigationInput, type Destination } from '@/lib/navigation'
import type { SurahMeta, Meta } from '@/lib/quran'
import { loadSurah, toFa } from '@/lib/quran'
import { createSearchSession, type SearchCorpus } from '@/lib/quran-search-session'
import type { QuranSearchResult } from '@/lib/quran-search'
import type { SearchMode } from '@/lib/quran-search-session'
import type { SearchStart } from './QuranSearch'

export default function QuickSurahSearch({ surah, meta, onNavigate, onClose, onPick, onAdvanced }: {
  meta: Meta; onNavigate: (destination: Destination) => void; surah: SurahMeta; onClose: () => void; onPick: (s: number, a: number, pos: number) => void
  onAdvanced: (start: Omit<SearchStart, 'revision'>) => void
}) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('text')
  const destinations = mode === 'text' ? searchDestinations(meta, query, surah.n) : []
  const [results, setResults] = useState<QuranSearchResult[]>([])
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const [engine, setEngine] = useState<ReturnType<typeof createSearchSession> | null>(null)
  const request = useRef(0)
  const pick = useRef(onPick); pick.current = onPick
  useEffect(() => { input.current?.focus({ preventScroll: true }) }, [])
  useEffect(() => {
    let live = true
    setEngine(null)
    loadSurah(surah.n).then(data => {
      const corpus: SearchCorpus = { verses: [], morphology: {}, waw: {} }
      for (const verse of data.v) {
        const key = `${data.n}:${verse.n}`
        corpus.verses.push([data.n, verse.n, verse.w.map(word => word.t)])
        corpus.morphology[key] = verse.w.map(word => [word.r ?? null, word.lemma ?? null, word.form ?? null])
        corpus.waw![key] = verse.w.flatMap((word, i) => word.wa ? [i + 1] : [])
      }
      if (live) setEngine(() => createSearchSession(corpus))
    }).catch(() => { if (live) setError(true) })
    return () => { live = false }
  }, [surah.n])
  const jump = (items: QuranSearchResult[], i: number) => {
    const item = items[i]
    if (item) { setIndex(i); pick.current(item.s, item.a, item.positions[0] ?? 1) }
  }
  useEffect(() => {
    const id = ++request.current
    setError(false); setResults([]); setIndex(0)
    const value = query.trim().replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    if (mode === 'text' && isNavigationInput(query)) { setBusy(false); return }
    if (/^\d+$/.test(value)) {
      const a = Number(value)
      if (a > 0 && a <= surah.vc) { const item = { s: surah.n, a, positions: [1], words: [], waw: [], parts: {}, kind: 'exact' as const, score: 0 }; setResults([item]); jump([item], 0) }
      setBusy(false); return
    }
    if (value.length < 2) { setBusy(false); return }
    setBusy(true)
    if (!engine) return
    const timer = setTimeout(() => {
      try {
        if (id !== request.current) return
        const items = engine(value, { mode, includePartial: true, surahs: [surah.n] }).sort((a, b) => a.a - b.a || a.positions[0] - b.positions[0])
        setResults(items); setBusy(false); jump(items, 0)
      } catch { setError(true); setBusy(false) }
    }, 60)
    return () => { clearTimeout(timer); request.current++ }
  }, [query, mode, surah.n, surah.vc, engine])
  const expand = (all: boolean) => onAdvanced({ query, mode, surahs: all ? [] : [surah.n] })
  return <div className="quick-surah-search" aria-label="جست‌وجوی سریع در سوره">
    <form onSubmit={event => { event.preventDefault(); if(destinations.length===1)onNavigate(destinations[0].destination); else if (results.length) jump(results, (index + 1) % results.length) }}>
      <button type="button" className="icon-btn" aria-label="بستن جست‌وجوی سریع" onClick={onClose}><ArrowRight size={20} /></button>
      <input ref={input} type="search" value={query} maxLength={160} onChange={event => setQuery(event.target.value)} aria-label="جست‌وجو در همین سوره" placeholder="واژه، آیه یا میان‌بر؛ مثلاً ق۶…" autoComplete="off" spellCheck={false} onKeyDown={event => { if (event.key === 'Escape') onClose() }} />
      {query && <button type="button" className="icon-btn" aria-label="پاک‌کردن جست‌وجوی سریع" onClick={() => { setQuery(''); input.current?.focus({ preventScroll: true }) }}><X size={18} /></button>}
    </form>
    {destinations.length>0&&<div className="quick-jump-options" aria-label="مقصد پیمایش">{destinations.map((item,i)=><button type="button" key={i} onClick={()=>onNavigate(item.destination)}>رفتن به {toFa(item.label)} ←</button>)}</div>}
    <div className="quick-search-status"><span>در سورهٔ {surah.fa}</span><span role="status" aria-live="polite">{destinations.length ? 'آمادهٔ رفتن' : busy ? 'در حال جست‌وجو…' : error ? 'بارگیری انجام نشد' : results.length ? `${toFa(index + 1)} از ${toFa(results.length)}` : query.trim().length >= 2 ? 'نتیجه‌ای نیست' : 'متن یا شمارهٔ آیه'}</span><button type="button" disabled={!results.length || busy} aria-label="نتیجهٔ قبلی در سوره" onClick={() => jump(results, (index - 1 + results.length) % results.length)}><ChevronRight size={18} /></button><button type="button" disabled={!results.length || busy} aria-label="نتیجهٔ بعدی در سوره" onClick={() => jump(results, (index + 1) % results.length)}><ChevronLeft size={18} /></button></div>
    <div className="quick-search-actions"><div role="group" aria-label="روش جست‌وجوی سریع">{([['text', 'متن'], ['root', 'ریشه'], ['lemma', 'بُن‌واژه']] as const).map(([key, title]) => <button type="button" key={key} aria-pressed={key === mode} onClick={() => setMode(key)}>{title}</button>)}</div><button type="button" onClick={() => expand(false)}>پیشرفته</button><button type="button" onClick={() => expand(true)}>کل قرآن ←</button></div>
  </div>
}
