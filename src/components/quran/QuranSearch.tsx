'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, LoaderCircle, ArrowRight, SlidersHorizontal, Languages, BookOpen } from 'lucide-react'
import type { Meta, Translator, Translations } from '@/lib/quran'
import { loadTrans, toFa } from '@/lib/quran'
import { type AnalysisSelection } from '@/lib/analysis'
import { normalizeQuranSearch, type QuranSearchResult } from '@/lib/quran-search'
import QuranText from './QuranText'
import { splitWord } from '@/lib/word-parts'

interface Props {
  occurrenceFilter?: AnalysisSelection | null
  onClearOccurrenceFilter?: () => void
  translator: Translator
  open: boolean
  onOpenChange: (open: boolean) => void
  meta: Meta
  currentSurah: number
  onPick: (s: number, a: number, pos: number) => void
}
function snippet(result: QuranSearchResult, full = false) {
  const first = (result.positions[0] ?? 1) - 1
  let last = first
  while (result.positions.includes(last + 2)) last++
  const from = full ? 0 : Math.max(0, first - 6)
  const to = full ? result.words.length : Math.min(result.words.length, Math.max(from + 30, last + 7))
  const tokens: { text: string; selected: boolean }[] = []
  for (let i = from; i < to; i++) {
    const { prefix, stem } = splitWord({ t: result.words[i], wa: result.waw.includes(i + 1) })
    const mask = result.parts[i + 1] ?? 0
    if (prefix) tokens.push({ text: prefix, selected: !!(mask & 1) })
    tokens.push({ text: stem, selected: !!(mask & 2) })
  }
  const runs: { selected: boolean; words: string[] }[] = []
  for (const token of tokens) {
    const previous = runs.at(-1)
    if (previous?.selected === token.selected) previous.words.push(token.text)
    else runs.push({ selected: token.selected, words: [token.text] })
  }
  return <>{from > 0 && '… '}{runs.map((run, i) => <span key={i}><span data-search-match={run.selected ? 'true' : undefined} className={run.selected ? 'rounded px-0.5' : undefined} style={run.selected ? { background: 'var(--word-selected)', color: 'var(--ink)', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' } : undefined}><QuranText text={run.words.join(' ')} /></span>{i < runs.length - 1 ? ' ' : null}</span>)}{to < result.words.length && ' …'}</>
}
const labels = { exact: 'تطبیق دقیق', partial: 'شامل عبارت', near: 'نزدیک از نظر نوشتار', root: 'هم‌ریشه‌ها' }

export default function QuranSearch({ open, onOpenChange, meta, currentSurah, onPick, occurrenceFilter, onClearOccurrenceFilter, translator }: Props) {
  const [query, setQuery] = useState('')
  const [includePartial, setIncludePartial] = useState(true)
  const [includeNear, setIncludeNear] = useState(false)
  const [includeRoots, setIncludeRoots] = useState(false)
  const [surahs, setSurahs] = useState<number[]>([])
  const [surahQuery, setSurahQuery] = useState('')
  const [showTranslation, setShowTranslation] = useState(false)
  const [translations, setTranslations] = useState<Record<number, Translations>>({})
  const [translationErrors, setTranslationErrors] = useState<number[]>([])
  const [translationRetry, setTranslationRetry] = useState(0)
  const [results, setResults] = useState<QuranSearchResult[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [visible, setVisible] = useState(20)
  const page = useRef<HTMLElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const scroll = useRef(0)
  const worker = useRef<Worker | null>(null)
  const request = useRef(0)
  const completed = useRef('')
  const pending = useRef('')
  const valid = !!occurrenceFilter || normalizeQuranSearch(query).replace(/\s/g, '').length >= 2
  const scopeKey = surahs.join(',')
  const canExpandRoots = occurrenceFilter ? !!occurrenceFilter.root && occurrenceFilter.part !== 'prefix' : !normalizeQuranSearch(query).includes(' ')

  useEffect(() => {
    if (occurrenceFilter) {
      setSurahs([occurrenceFilter.s]); setIncludeRoots(occurrenceFilter.tab === 'root'); setQuery('')
    }
  }, [occurrenceFilter])
  useEffect(() => () => worker.current?.terminate(), [])
  useEffect(() => {
    if (!open) return
    const focused = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    const siblings = [...document.body.children].filter((element): element is HTMLElement => element instanceof HTMLElement && element !== page.current)
    const previous = siblings.map(element => element.inert)
    siblings.forEach(element => { element.inert = true })
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => {
      if (occurrenceFilter || valid && completed.current) list.current?.focus({ preventScroll: true })
      else input.current?.focus({ preventScroll: true })
      if (list.current) list.current.scrollTop = scroll.current
    })
    return () => {
      siblings.forEach((element, i) => { element.inert = previous[i] })
      document.body.style.overflow = overflow
      focused?.focus({ preventScroll: true })
    }
  }, [open])
  useEffect(() => {
    if (!open) { request.current++; return }
    const id = ++request.current
    const options = { includePartial, includeNear, includeRoots: includeRoots && canExpandRoots, surahs }
    const key = JSON.stringify({ query, options, filter: occurrenceFilter })
    if (!error && completed.current === key) { setBusy(false); return }
    pending.current = key; setVisible(20); scroll.current = 0; setError(false)
    if (list.current) list.current.scrollTop = 0
    if (!valid) { completed.current = ''; setResults([]); setBusy(false); return }
    setBusy(true)
    const timer = setTimeout(() => {
      try {
        if (!worker.current) {
          worker.current = new Worker(new URL('../../lib/quran-search.worker.ts', import.meta.url), { type: 'module' })
          worker.current.onmessage = (event: MessageEvent<{ id: number; results?: QuranSearchResult[]; error?: boolean }>) => {
            if (event.data.id !== request.current) return
            completed.current = event.data.error ? '' : pending.current
            setResults(event.data.results ?? []); setError(!!event.data.error); setBusy(false)
          }
          worker.current.onerror = () => { setError(true); setBusy(false); worker.current?.terminate(); worker.current = null }
        }
        worker.current.postMessage({ id, query, options, filter: occurrenceFilter })
      } catch { setError(true); setBusy(false) }
    }, 180)
    return () => { clearTimeout(timer); request.current++ }
  }, [query, scopeKey, includePartial, includeNear, includeRoots, canExpandRoots, valid, retry, open, occurrenceFilter])

  const visibleSurahs = showTranslation && open ? [...new Set(results.slice(0, visible).map(r => r.s))].join(',') : ''
  useEffect(() => {
    if (!visibleSurahs) return
    let live = true
    const numbers = visibleSurahs.split(',').map(Number).filter(n => !translations[n])
    for (const s of numbers) loadTrans(s).then(data => {
      if (live) { setTranslations(current => ({ ...current, [s]: data })); setTranslationErrors(current => current.filter(n => n !== s)) }
    }).catch(() => { if (live) setTranslationErrors(current => [...new Set([...current, s])]) })
    return () => { live = false }
  }, [visibleSurahs, translationRetry])

  const setScope = (s: number, checked: boolean) => setSurahs(current => checked ? [...current, s].sort((a, b) => a - b) : current.filter(n => n !== s))
  const scopeLabel = surahs.length === 0 ? 'همهٔ قرآن' : surahs.length === 1 ? `سورهٔ ${meta.surahs[surahs[0] - 1]?.fa}` : `${toFa(surahs.length)} سوره`
  if (!open) return null
  return createPortal(<main ref={page} className="quran-search-page" data-search-page dir="rtl" aria-label="جست‌وجو در قرآن" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onOpenChange(false) } }}>
    <div className="search-page-shell">
      <header className="search-page-header">
        <div className="search-page-title"><button type="button" className="icon-btn" aria-label="بازگشت به قرآن" onClick={() => onOpenChange(false)}><ArrowRight size={21} /></button><div><h1>جست‌وجو در قرآن</h1><p>از واژه تا ریشه، در سوره‌های دلخواه</p></div></div>
        <div className="search-page-input"><Search size={20} aria-hidden="true" /><input ref={input} type="search" value={query} maxLength={160} onChange={event => { if (occurrenceFilter) onClearOccurrenceFilter?.(); setQuery(event.target.value) }} aria-label="عبارت جست‌وجو در متن قرآن" placeholder={occurrenceFilter ? 'برای جست‌وجوی تازه بنویسید…' : 'واژه یا عبارت قرآنی…'} autoComplete="off" autoCorrect="off" spellCheck={false} />{query && <button type="button" aria-label="پاک کردن عبارت" onClick={() => setQuery('')}><X size={17} /></button>}</div>
        {occurrenceFilter && <div className="search-active-filter"><span>{includeRoots && canExpandRoots ? `ریشهٔ ${occurrenceFilter.root ?? ''}` : occurrenceFilter.tab === 'form' ? `باب ${occurrenceFilter.form} · ${occurrenceFilter.root ?? ''}` : `بن‌واژهٔ ${occurrenceFilter.text}`}</span><button type="button" aria-label="حذف فیلتر تکرارها" onClick={onClearOccurrenceFilter}><X size={14} /></button></div>}
        <div className="search-page-tools">
          <details className="search-scope"><summary><SlidersHorizontal size={16} /><span>{scopeLabel}</span><span className="search-scope-action">انتخاب سوره‌ها</span></summary>
            <div className="search-scope-panel"><div className="search-scope-shortcuts"><button type="button" onClick={() => setSurahs([])}>همهٔ قرآن</button><button type="button" onClick={() => setSurahs([currentSurah])}>همین سوره</button></div><input type="search" value={surahQuery} onChange={e => setSurahQuery(e.target.value)} placeholder="نام یا شمارهٔ سوره" aria-label="یافتن سوره" /><p>بدون انتخاب سوره، در کل قرآن جست‌وجو می‌شود.</p><div className="search-surah-options">{meta.surahs.filter(s => normalizeQuranSearch(`${s.fa} ${s.ar} ${s.n} ${toFa(s.n)}`).includes(normalizeQuranSearch(surahQuery))).map(s => <label key={s.n}><input type="checkbox" checked={surahs.includes(s.n)} onChange={event => setScope(s.n, event.target.checked)} /><span>{toFa(s.n)} · {s.fa}</span></label>)}</div></div>
          </details>
          <button type="button" className="search-translation-toggle" aria-pressed={showTranslation} onClick={() => setShowTranslation(value => !value)}><Languages size={17} />ترجمه</button>
        </div>
        <div className="search-match-options">
          <label><input type="checkbox" checked={includePartial} disabled={!!occurrenceFilter} onChange={e => setIncludePartial(e.target.checked)} />شامل عبارت</label>
          <label title={!canExpandRoots ? 'هم‌ریشه‌ها برای جست‌وجوی تک‌واژه فعال می‌شود' : undefined}><input type="checkbox" checked={includeRoots && canExpandRoots} disabled={!canExpandRoots} onChange={e => setIncludeRoots(e.target.checked)} />هم‌ریشه‌ها</label>
          <label><input type="checkbox" checked={includeNear} disabled={!!occurrenceFilter} onChange={e => setIncludeNear(e.target.checked)} />خطای املایی</label>
        </div>
      </header>
      <div className="search-results-summary" role="status" aria-live="polite">{busy ? <span><LoaderCircle size={15} className="animate-spin" />در حال جست‌وجو…</span> : !valid ? 'اعراب و تفاوت «ک» و «ی» فارسی و عربی مانع جست‌وجو نیست.' : error ? 'بارگیری جست‌وجو انجام نشد.' : `${toFa(results.length)} آیه · ${toFa(results.reduce((sum, r) => sum + r.positions.length, 0))} تطبیق`}</div>
      <div ref={list} className="search-page-results nice-scroll" tabIndex={-1} aria-label="نتایج جست‌وجو" aria-busy={busy} onScroll={event => { scroll.current = event.currentTarget.scrollTop }}>
        {!valid && <div className="search-empty"><BookOpen size={34} /><h2>دنبال چه می‌گردی؟</h2><p>یک واژه یا عبارت بنویس و محدودهٔ جست‌وجو را انتخاب کن.</p><div>{['لا تخف', 'رحمة', 'رزق'].map(text => <button type="button" key={text} onClick={() => setQuery(text)}>{text}</button>)}</div></div>}
        {error && <button type="button" className="chip" onClick={() => setRetry(value => value + 1)}>تلاش دوباره</button>}
        {!busy && !error && valid && !results.length && <div className="search-empty"><Search size={30} /><h2>نتیجه‌ای پیدا نشد</h2><p>عبارت یا سوره‌های انتخابی را تغییر بده؛ برای واژه‌های نزدیک، «خطای املایی» را روشن کن.</p></div>}
        {!busy && !error && valid && results.slice(0, visible).map((result, index) => <div key={`${result.s}:${result.a}`}>
          {!occurrenceFilter && (index === 0 || results[index - 1].kind !== result.kind) && <h2 className="search-result-group">{labels[result.kind]}</h2>}
          <article className="search-result-card"><button type="button" className="search-result-open" aria-label={`رفتن به ${meta.surahs[result.s - 1]?.fa} آیه ${toFa(result.a)}`} onClick={() => { scroll.current = list.current?.scrollTop ?? scroll.current; onPick(result.s, result.a, result.positions[0] ?? 1) }}>
            <span className="search-result-meta"><b>{meta.surahs[result.s - 1]?.fa} · آیهٔ {toFa(result.a)}</b><span>رفتن به آیه ←</span></span><span className="search-result-text font-quran" lang="ar">{snippet(result, true)}</span>
          </button>
          {showTranslation && <div className="search-result-translation">{translations[result.s]?.[String(result.a)]?.[translator] ?? (translationErrors.includes(result.s) ? <button type="button" onClick={() => setTranslationRetry(n => n + 1)}>ترجمه بارگیری نشد؛ تلاش دوباره</button> : <span role="status">در حال بارگیری ترجمه…</span>)}</div>}
          </article>
        </div>)}
        {!busy && valid && visible < results.length && <button type="button" className="search-more" onClick={() => setVisible(count => count + 20)}>آیات بیشتر · {toFa(visible)} از {toFa(results.length)}</button>}
      </div>
    </div>
  </main>, document.body)
}
