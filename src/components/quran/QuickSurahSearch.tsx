'use client'
import {DictationInput} from './DictationInput'
import {normalizeDigits} from '@/lib/locale-numbers'
import {t} from '@/lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { searchDestinations, isNavigationInput, type Destination } from '@/lib/navigation'
import type { SurahMeta, Meta } from '@/lib/quran'
import { loadSurah, toFa } from '@/lib/quran'
import { createSearchSession, type SearchCorpus } from '@/lib/quran-search-session'
import type { QuranSearchResult } from '@/lib/quran-search'
import type { SearchMode } from '@/lib/quran-search-session'
import type { SearchStart } from './QuranSearch'

export default function QuickSurahSearch({ surah: currentSurah, scope, onScopeChange, meta, onNavigate, onClose, onPick, onAdvanced, onHighlights }: {
  scope: 'surah' | 'quran'; onScopeChange: (scope: 'surah' | 'quran') => void
  meta: Meta; onNavigate: (destination: Destination) => void; surah: SurahMeta; onClose: () => void; onPick: (s: number, a: number, pos: number) => void
  onAdvanced: (start: Omit<SearchStart, 'revision'>) => void
  onHighlights:(value:{results:QuranSearchResult[];index:number})=>void
}) {
  // The source surah belongs to this search, not to whichever hit is revealed.
  const [surah, setSurah] = useState(currentSurah)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('text')
  const destinations = mode === 'text' ? searchDestinations(meta, query, surah.n) : []
  const [results, setResults] = useState<QuranSearchResult[]>([])
  const [index, setIndex] = useState(0)
  const report=useRef(onHighlights);report.current=onHighlights
  useEffect(()=>{report.current({results,index})},[results,index])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const [engine, setEngine] = useState<ReturnType<typeof createSearchSession> | null>(null)
  const request = useRef(0)
  const pick = useRef(onPick); pick.current = onPick
  const worker = useRef<Worker | null>(null)
  useEffect(() => {
    if (scope !== 'quran') return
    const instance = new Worker(new URL('../../lib/quran-search.worker.ts', import.meta.url), { type: 'module' })
    worker.current = instance
    return () => { worker.current = null; instance.terminate() }
  }, [scope])
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
  const localEngine = scope === 'surah' ? engine : null
  useEffect(() => {
    const id = ++request.current
    setError(false); setResults([]); setIndex(0)
    const value = normalizeDigits(query).trim().replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    if (mode === 'text' && (isNavigationInput(query) || destinations.length > 0 && !/^\d+$/.test(value))) { setBusy(false); return }
    if (/^\d+$/.test(value)) {
      const a = Number(value)
      if (a > 0 && a <= surah.vc) { const item = { s: surah.n, a, positions: [1], words: [], waw: [], parts: {}, kind: 'exact' as const, score: 0 }; setResults([item]); jump([item], 0) }
      setBusy(false); return
    }
    if (value.length < 2) { setBusy(false); return }
    setBusy(true)
    if (scope === 'surah' && !localEngine) return
    const timer = setTimeout(() => {
      const receive = (items: QuranSearchResult[]) => {
        if (id !== request.current) return
        items.sort((a, b) => a.s - b.s || a.a - b.a || a.positions[0] - b.positions[0])
        setResults(items); setBusy(false); jump(items, 0)
      }
      try {
        if (id !== request.current) return
        if (scope === 'quran' && worker.current) {
          worker.current.onmessage = (event: MessageEvent<{id:number;results?:QuranSearchResult[];error?:boolean}>) => {
            if (event.data.id !== request.current) return
            if (event.data.error) { setError(true); setBusy(false) }
            else receive(event.data.results ?? [])
          }
          worker.current.onerror = () => { if (id === request.current) { setError(true); setBusy(false) } }
          worker.current.postMessage({ id, query: value, options: { mode, includePartial: true, surahs: [] } })
        } else if (localEngine) receive(localEngine(value, { mode, includePartial: true, surahs: [surah.n] }))
      } catch { setError(true); setBusy(false) }
    }, 60)
    return () => { clearTimeout(timer); request.current++ }
  }, [query, mode, surah.n, surah.vc, localEngine, scope])
  const expand = (all: boolean) => onAdvanced({ query, mode, surahs: all ? [] : [surah.n] })
  const activeResult = busy || error ? undefined : results[index]
  const resultAddress = (result: QuranSearchResult) => `${meta.surahs[result.s - 1].fa} · ${toFa(result.a)}`
  const adjacentResults = [
    { direction: 'previous', step: -1, Icon: ChevronRight, globalLabel: 'quickSearch.previousResult', localLabel: 'ui.1cfdb521b9' },
    { direction: 'next', step: 1, Icon: ChevronLeft, globalLabel: 'quickSearch.nextResult', localLabel: 'ui.3c9bb58eee' },
  ] as const
  return <div className="quick-surah-search" aria-label={t("ui.a1edc5936b")}>
    <form onSubmit={event => { event.preventDefault(); if(destinations.length===1)onNavigate(destinations[0].destination); else if (results.length) jump(results, (index + 1) % results.length) }}>
      <button type="button" className="icon-btn" aria-label={t("ui.8b070f0497")} onClick={onClose}><ArrowRight size={20} /></button>
      <DictationInput speechLocale="ar" ref={input} type="search" value={query} maxLength={160} onChange={event => setQuery(event.target.value)} aria-label={t("ui.26fa3c1923")} placeholder={t("ui.a2897ec32a")} autoComplete="off" spellCheck={false} onKeyDown={event => { if (event.key === 'Escape') onClose() }} />
      {query && <button type="button" className="icon-btn" aria-label={t("ui.b091494ed6")} onClick={() => { setQuery(''); input.current?.focus({ preventScroll: true }) }}><X size={18} /></button>}
    </form>
    {destinations.length>0&&<div className="quick-jump-options" aria-label={t("ui.d289fa208b")}>{destinations.map((item,i)=><button type="button" key={i} onClick={()=>onNavigate(item.destination)}>{t("ui.b7b6972c78")}{' '}{toFa(item.label)} ←</button>)}</div>}
    <div className="quick-search-status" data-has-result={activeResult ? '' : undefined}>
      {!activeResult && <span className="quick-search-status-scope">{scope === 'quran' ? t('occurrence.wholeQuran') : <>{t("ui.ec5841b226")}{' '}{surah.fa}</>}</span>}
      <span role="status" aria-live="polite" aria-atomic="true">
        {activeResult ? <>
          <bdi className="quick-search-result-address">{resultAddress(activeResult)}</bdi>
          <span>{t('ui.53b89ec77a', { p0: toFa(index + 1), p1: toFa(results.length) })}</span>
        </> : destinations.length ? t('ui.4f981a291d') : busy ? t('ui.63509f3da4') : error ? t('ui.e5d91b8562') : query.trim().length >= 2 ? t('ui.292cf63931') : t('ui.d1400e3d47')}
      </span>
      {adjacentResults.map(({ direction, step, Icon, globalLabel, localLabel }) => {
        const targetIndex = activeResult && results.length > 1
          ? (index + step + results.length) % results.length
          : -1
        const target = results[targetIndex]
        const address = target && resultAddress(target)
        return <button key={direction} type="button" data-result-direction={direction} disabled={!target}
          aria-label={t(scope === 'quran' ? globalLabel : localLabel)} aria-description={address}
          onClick={() => jump(results, targetIndex)}>
          <Icon size={16} aria-hidden="true" />
          {address && <span className="quick-search-neighbor-label">
            <span>{t(globalLabel)}</span>
            <bdi className="quick-search-result-address">{address}</bdi>
          </span>}
        </button>
      })}
    </div>
    <div className="quick-search-actions">
      <div className="quick-search-mode quick-search-segment" role="group" aria-label={t("ui.5e4040c150")}>{([['text', t("ui.0f4147fe60")], ['root', t("ui.eecfc08eb8")], ['lemma', t("ui.8d5e58ddd8")]] as const).map(([key, title]) => <button type="button" key={key} aria-pressed={key === mode} onClick={() => setMode(key)}><span>{title}</span></button>)}</div>
      <div className="quick-search-scope quick-search-segment" role="group" aria-label={t('occurrence.searchIn')}>
        {(['surah','quran'] as const).map(value => <button type="button" key={value} aria-pressed={scope === value} onClick={() => { if (value === 'surah' && scope !== value) setSurah(currentSurah); onScopeChange(value) }}><span>{t(value === 'surah' ? 'occurrence.thisSurah' : 'occurrence.wholeQuran')}</span></button>)}
      </div>
      <button type="button" className="quick-search-advanced" onClick={() => expand(scope === 'quran')}><Search size={14} aria-hidden="true" />{t("ui.9617b95709")}</button>
    </div>
  </div>
}
