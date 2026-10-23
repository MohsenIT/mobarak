'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, LoaderCircle, ArrowRight, SlidersHorizontal, Languages, BookOpen, MoreHorizontal } from 'lucide-react'
import type { Meta, Translator, Translations } from '@/lib/quran'
import { loadTrans, toFa, morphologyLabel } from '@/lib/quran'
import { type AnalysisSelection } from '@/lib/analysis'
import { normalizeQuranSearch, type QuranSearchResult } from '@/lib/quran-search'
import QuranText from './QuranText'
import { splitWord } from '@/lib/word-parts'
import type { SearchMode } from '@/lib/quran-search-session'
import { lemmaDisplay } from '@/lib/lemma-display'
import { searchFormLabels } from '@/lib/search-form-labels'
import { filterSearchFacets, searchFacetCounts } from '@/lib/search-facets'
export type SearchStart = { query: string; mode: SearchMode; surahs: number[]; revision: number }

interface Props {
  initialSearch?: SearchStart | null
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

export default function QuranSearch({ open, onOpenChange, meta, currentSurah, onPick, occurrenceFilter, onClearOccurrenceFilter, translator, initialSearch }: Props) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('text')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [completionOpen, setCompletionOpen] = useState(false)
  const [completionIndex, setCompletionIndex] = useState(-1)
  const [lemmas, setLemmas] = useState<string[]>([])
  const [forms, setForms] = useState<string[]>([])
  const [includePartial, setIncludePartial] = useState(true)
  const [includeNear, setIncludeNear] = useState(false)
  const [includeRoots, setIncludeRoots] = useState(true)
  const [surahs, setSurahs] = useState<number[]>([])
  const [surahQuery, setSurahQuery] = useState('')
  const [showTranslation, setShowTranslation] = useState(false)
  const [translations, setTranslations] = useState<Record<number, Translations>>({})
  const [translationErrors, setTranslationErrors] = useState<number[]>([])
  const [translationRetry, setTranslationRetry] = useState(0)
  const [rawResults, setResults] = useState<QuranSearchResult[]>([])
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
  const facets = { lemmas, forms }
  const formLabels = searchFormLabels(rawResults)
  const results = filterSearchFacets(rawResults, facets)
  useEffect(() => { if (initialSearch) { setQuery(initialSearch.query); setMode(initialSearch.mode); setSurahs(initialSearch.surahs); setIncludeRoots(true); setIncludeNear(false); setIncludePartial(true) } }, [initialSearch])
  useEffect(() => { setLemmas([]); setForms([]) }, [query, mode, includeRoots, occurrenceFilter, surahs.join(',')])
  const valid = !!occurrenceFilter || normalizeQuranSearch(query).replace(/\s/g, '').length >= 2
  const scopeKey = surahs.join(',')
  const canExpandRoots = occurrenceFilter ? !!occurrenceFilter.root && occurrenceFilter.part !== 'prefix' : !normalizeQuranSearch(query).includes(' ')

  useEffect(() => {
    if (occurrenceFilter) {
      setIncludeNear(false); setIncludeRoots(occurrenceFilter.tab === 'root'); setQuery('')
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
    const options = { mode, includePartial, includeNear, includeRoots: includeRoots && canExpandRoots, surahs }
    const key = JSON.stringify({ query, options, filter: occurrenceFilter })
    if (!error && completed.current === key) { setBusy(false); return }
    pending.current = key; setVisible(20); scroll.current = 0; setError(false)
    if (list.current) list.current.scrollTop = 0
    if (!valid && normalizeQuranSearch(query).length === 0) { completed.current = ''; setResults([]); setSuggestions([]); setBusy(false); return }
    setBusy(true)
    const timer = setTimeout(() => {
      try {
        if (!worker.current) {
          worker.current = new Worker(new URL('../../lib/quran-search.worker.ts', import.meta.url), { type: 'module' })
          worker.current.onmessage = (event: MessageEvent<{ id: number; results?: QuranSearchResult[]; suggestions?: string[]; error?: boolean }>) => {
            if (event.data.id !== request.current) return
            completed.current = event.data.error ? '' : pending.current
            setResults(event.data.results ?? []); setSuggestions(event.data.suggestions ?? []); setCompletionIndex(-1); setError(!!event.data.error); setBusy(false)
          }
          worker.current.onerror = () => { setError(true); setBusy(false); worker.current?.terminate(); worker.current = null }
        }
        worker.current.postMessage({ id, query, options, filter: occurrenceFilter })
      } catch { setError(true); setBusy(false) }
    }, 100)
    return () => { clearTimeout(timer); request.current++ }
  }, [query, mode, scopeKey, includePartial, includeNear, includeRoots, canExpandRoots, valid, retry, open, occurrenceFilter])

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

  const toggleFacet = (kind: 'lemmas' | 'forms', value: string) => {
    const setter = kind === 'lemmas' ? setLemmas : setForms
    setter(current => current.includes(value) ? current.filter(x => x !== value) : [...current, value]); setVisible(20); scroll.current = 0; if (list.current) list.current.scrollTop = 0
  }
  const setScope = (s: number, checked: boolean) => setSurahs(current => checked ? [...current, s].sort((a, b) => a - b) : current.filter(n => n !== s))
  const scopeLabel = surahs.length === 0 ? 'همهٔ قرآن' : surahs.length === 1 ? `سورهٔ ${meta.surahs[surahs[0] - 1]?.fa}` : `${toFa(surahs.length)} سوره`
  if (!open) return null
  return createPortal(<main ref={page} className="quran-search-page" data-search-page dir="rtl" aria-label="جست‌وجو در قرآن" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onOpenChange(false) } }}>
    <div className="search-page-shell">
      <header className="search-page-header">
        <h1 className="sr-only">جست‌وجو در قرآن</h1>
        <div className="search-command-row">
          <button type="button" className="icon-btn" aria-label="بازگشت به قرآن" onClick={() => onOpenChange(false)}><ArrowRight size={20} /></button>
          <div className="search-page-input">
            <Search size={17} aria-hidden="true" />
            <input ref={input} type="search" value={query} maxLength={160} role="combobox" aria-autocomplete="list" aria-expanded={completionOpen && !busy && suggestions.length > 0} aria-controls="search-completions" aria-activedescendant={completionOpen && completionIndex >= 0 ? `search-completion-${completionIndex}` : undefined}
              onFocus={() => setCompletionOpen(true)} onBlur={event => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setCompletionOpen(false) }}
              onChange={event => { if (occurrenceFilter) onClearOccurrenceFilter?.(); setQuery(event.target.value); setCompletionOpen(true); setCompletionIndex(-1) }}
              onKeyDown={event => {
                if (event.key === 'ArrowDown' && !busy && suggestions.length) { event.preventDefault(); setCompletionOpen(true); setCompletionIndex(i => (i + 1) % suggestions.length) }
                else if (event.key === 'ArrowUp' && !busy && suggestions.length) { event.preventDefault(); setCompletionOpen(true); setCompletionIndex(i => (i - 1 + suggestions.length) % suggestions.length) }
                else if (event.key === 'Enter') { event.preventDefault(); if (completionOpen && completionIndex >= 0) setQuery(suggestions[completionIndex]); setCompletionOpen(false); input.current?.blur() }
                else if (event.key === 'Escape' && completionOpen) { event.preventDefault(); event.stopPropagation(); setCompletionOpen(false) }
              }}
              aria-label={mode === 'root' ? 'جست‌وجوی ریشه' : mode === 'lemma' ? 'جست‌وجوی بُن‌واژه' : 'عبارت جست‌وجو در متن قرآن'} placeholder={occurrenceFilter ? 'جست‌وجوی تازه…' : mode === 'root' ? 'ریشه؛ مثلاً علم' : mode === 'lemma' ? 'بُن‌واژه…' : 'واژه یا عبارت…'} autoComplete="off" autoCorrect="off" spellCheck={false} />
            {query && <button type="button" aria-label="پاک کردن عبارت" onClick={() => { setQuery(''); input.current?.focus({ preventScroll: true }) }}><X size={15} /></button>}
            {completionOpen && !busy && suggestions.length > 0 && !occurrenceFilter && <div id="search-completions" className="search-completion-menu" role="listbox" aria-label="پیشنهادهای جست‌وجو">{suggestions.map((value, i) => <button type="button" role="option" id={`search-completion-${i}`} aria-selected={completionIndex === i} key={value} onMouseDown={event => event.preventDefault()} onClick={() => { setQuery(value); setCompletionOpen(false); input.current?.blur() }}><Search size={14} /><QuranText text={value} /><span aria-hidden="true">↖</span></button>)}</div>}
          </div>
          <button type="button" className="icon-btn search-translation-toggle" aria-label="ترجمه" title="نمایش یا پنهان‌کردن ترجمه" aria-pressed={showTranslation} onClick={() => setShowTranslation(value => !value)}><Languages size={20} /></button>
        </div>
        <div className="search-controls-row">
          <div className="search-mode-tabs" role="group" aria-label="روش جست‌وجو">{([['text', 'متن'], ['root', 'ریشه'], ['lemma', 'بُن‌واژه']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={mode === key && !occurrenceFilter} onClick={() => { onClearOccurrenceFilter?.(); setSuggestions([]); setMode(key); input.current?.focus({ preventScroll: true }) }}>{label}</button>)}</div>
          {(mode === 'text' || !!occurrenceFilter) && <button type="button" className="search-roots-toggle" aria-pressed={includeRoots && canExpandRoots} disabled={!canExpandRoots} title={!canExpandRoots ? 'هم‌ریشه‌ها برای یک واژه فعال است' : 'صورت‌های دیگر همین ریشه را هم نشان بده'} onClick={() => setIncludeRoots(value => !value)}>هم‌ریشه‌ها</button>}
          <details className="search-scope"><summary aria-label="انتخاب سوره‌ها"><SlidersHorizontal size={14} /><span>{scopeLabel}</span></summary>
            <div className="search-scope-panel"><div className="search-scope-shortcuts"><button type="button" onClick={() => setSurahs([])}>همهٔ قرآن</button><button type="button" onClick={() => setSurahs([currentSurah])}>همین سوره</button></div><input type="search" value={surahQuery} onChange={e => setSurahQuery(e.target.value)} placeholder="نام یا شمارهٔ سوره" aria-label="یافتن سوره" /><p>بدون انتخاب سوره، در کل قرآن جست‌وجو می‌شود.</p><div className="search-surah-options">{meta.surahs.filter(s => normalizeQuranSearch(`${s.fa} ${s.ar} ${s.n} ${toFa(s.n)}`).includes(normalizeQuranSearch(surahQuery))).map(s => <label key={s.n}><input type="checkbox" checked={surahs.includes(s.n)} onChange={event => setScope(s.n, event.target.checked)} /><span>{toFa(s.n)} · {s.fa}</span></label>)}</div></div>
          </details>
          <details className="search-extra-options"><summary aria-label="گزینه‌های بیشتر جست‌وجو"><MoreHorizontal size={19} /></summary><div>
            <label><input type="checkbox" checked={includePartial} disabled={!!occurrenceFilter || mode !== 'text'} onChange={e => setIncludePartial(e.target.checked)} />شامل بخشی از کلمه</label>
            <label><input type="checkbox" checked={includeNear} disabled={!!occurrenceFilter || mode !== 'text'} onChange={e => setIncludeNear(e.target.checked)} />تحمل خطای املایی</label>
          </div></details>
        </div>
        {includeNear && mode === 'text' && <button type="button" className="search-active-filter" aria-label="غیرفعال‌کردن خطای املایی" onClick={() => setIncludeNear(false)}>خطای املایی فعال است <X size={12} /></button>}
        {occurrenceFilter && <div className="search-active-filter"><span>{includeRoots && canExpandRoots ? `ریشهٔ ${occurrenceFilter.root ?? ''}` : occurrenceFilter.tab === 'form' ? `باب ${occurrenceFilter.form} · ${occurrenceFilter.root ?? ''}` : `بن‌واژهٔ ${occurrenceFilter.text}`}</span><button type="button" aria-label="حذف فیلتر تکرارها" onClick={onClearOccurrenceFilter}><X size={14} /></button></div>}
      </header>
      <div className="search-results-summary" role="status" aria-live="polite">{busy ? <span><LoaderCircle size={15} className="animate-spin" />در حال جست‌وجو…</span> : !valid ? 'اعراب و تفاوت «ک» و «ی» فارسی و عربی مانع جست‌وجو نیست.' : error ? 'بارگیری جست‌وجو انجام نشد.' : `${toFa(results.length)} آیه · ${toFa(results.reduce((sum, r) => sum + r.positions.length, 0))} تطبیق`}</div>
      <div ref={list} className="search-page-results nice-scroll" tabIndex={-1} aria-label="نتایج جست‌وجو" aria-busy={busy} onScroll={event => { scroll.current = event.currentTarget.scrollTop }}>
        {!busy && rawResults.length > 0 && <div className="search-facets-inline" aria-label="فیلتر نتایج">
          {(['forms', 'lemmas'] as const).map(kind => <SearchFacetGroup key={`${mode}:${query}:${kind}`} kind={kind} formLabels={formLabels} counts={searchFacetCounts(rawResults, facets, kind)} selected={facets[kind]} onToggle={value => toggleFacet(kind, value)} />)}
          {(lemmas.length > 0 || forms.length > 0) && <div className="search-active-facets">{(['forms', 'lemmas'] as const).flatMap(kind => facets[kind].map(value => <button type="button" key={`${kind}:${value}`} aria-label={`حذف فیلتر ${kind === 'forms' ? formLabels.get(value)?.label ?? morphologyLabel(value) : lemmaDisplay(value)}`} onClick={() => toggleFacet(kind, value)}>{kind === 'forms' ? formLabels.get(value)?.label ?? morphologyLabel(value) : lemmaDisplay(value)}<X size={12} /></button>))}<button type="button" onClick={() => { setLemmas([]); setForms([]) }}>حذف فیلترها</button></div>}
        </div>}
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


function SearchFacetGroup({ kind, counts, selected, onToggle, formLabels }: {
  formLabels: Map<string, { label: string; description: string }>; kind: 'forms' | 'lemmas'; counts: { value: string; count: number }[]; selected: string[]; onToggle: (value: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  if (!counts.length) return null
  return <div className="search-facet-row" role="group" aria-label={kind === 'forms' ? 'فیلتر باب' : 'فیلتر بُن‌واژه'}>
    <span>{kind === 'forms' ? 'باب' : 'بُن‌واژه'}</span><div>{(expanded ? counts : counts.slice(0, 3)).map(({ value, count }) => <button type="button" key={value} aria-pressed={selected.includes(value)} title={kind === 'forms' ? formLabels.get(value)?.description ?? morphologyLabel(value) : undefined} onClick={() => onToggle(value)}><span>{kind === 'forms' ? formLabels.get(value)?.label ?? morphologyLabel(value) : <QuranText text={lemmaDisplay(value)} />}</span><small>{toFa(count)}</small></button>)}
    {counts.length > 3 && <button type="button" className="search-facet-more" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'کمتر' : `+${toFa(counts.length - 3)} بیشتر`}</button>}</div>
  </div>
}
