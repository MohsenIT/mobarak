'use client'
import {DictationInput} from './DictationInput'
import {translationDirection,translationLanguage} from '@/lib/translations'
import {t,uiDirection} from '@/lib/i18n'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {IconTranslate} from './Ornaments'
import { Search, X, LoaderCircle, ArrowRight, Funnel, BookOpen, MoreVertical, Link, Check } from 'lucide-react'
import type { Meta, Translator, Translations } from '@/lib/quran'
import { loadTrans, toFa, morphologyLabel } from '@/lib/quran'
import { type AnalysisSelection } from '@/lib/analysis'
import { normalizeQuranSearch, type QuranSearchResult } from '@/lib/quran-search'
import QuranText from './QuranText'
import { splitWord } from '@/lib/word-parts'
import type { SearchMode } from '@/lib/quran-search-session'
import { lemmaDisplay } from '@/lib/lemma-display'
import { searchFormLabels } from '@/lib/search-form-labels'
import { searchDestinations, isNavigationInput, type Destination } from '@/lib/navigation'
import { searchLink, type SearchLinkState } from '@/lib/search-link'
import { filterSearchFacets, searchFacetCounts } from '@/lib/search-facets'
export type SearchStart = { query: string; mode: SearchMode; surahs: number[]; revision: number; state?: SearchLinkState }

interface Props {
  onNavigate?: (destination: Destination) => void
  onStateChange?: (state: SearchLinkState) => void
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
const labels = { exact: t("ui.e3aee9c005"), partial: t("ui.b3541360ab"), near: t("ui.8a95e90fb6"), root: t("ui.702b74fe3e") }

export default function QuranSearch({ open, onOpenChange, meta, currentSurah, onPick, occurrenceFilter, onClearOccurrenceFilter, translator, initialSearch, onStateChange, onNavigate }: Props) {
  const restored = initialSearch?.state
  const [copyStatus, setCopyStatus] = useState('')
  const [query, setQuery] = useState(restored?.query ?? initialSearch?.query ?? '')
  const [mode, setMode] = useState<SearchMode>(restored?.mode ?? initialSearch?.mode ?? 'text')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [completionOpen, setCompletionOpen] = useState(false)
  const [completionIndex, setCompletionIndex] = useState(-1)
  const [lemmas, setLemmas] = useState<string[]>(restored?.lemmas ?? [])
  const [forms, setForms] = useState<string[]>(restored?.forms ?? [])
  const [includePartial, setIncludePartial] = useState(restored?.includePartial ?? true)
  const [includeNear, setIncludeNear] = useState(restored?.includeNear ?? false)
  const [includeRoots, setIncludeRoots] = useState(restored?.includeRoots ?? true)
  const [surahs, setSurahs] = useState<number[]>(restored?.surahs ?? initialSearch?.surahs ?? [])
  const [surahQuery, setSurahQuery] = useState('')
  const [showTranslation, setShowTranslation] = useState(restored?.showTranslation ?? false)
  const [translations, setTranslations] = useState<Record<number, Translations>>({})
  const [translationErrors, setTranslationErrors] = useState<number[]>([])
  const [translationRetry, setTranslationRetry] = useState(0)
  const [rawResults, setResults] = useState<QuranSearchResult[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [visible, setVisible] = useState(20)
  const [currentResult, setCurrentResult] = useState(1)
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
  const facetIdentity = JSON.stringify([query, mode, includeRoots, occurrenceFilter, surahs])
  const previousFacetIdentity = useRef(facetIdentity)
  useEffect(() => {
    if (previousFacetIdentity.current !== facetIdentity) { setLemmas([]); setForms([]); previousFacetIdentity.current = facetIdentity }
  }, [facetIdentity])
  const linkState: SearchLinkState = { query, mode, ...(isNavigationInput(query)?{contextSurah:restored?.contextSurah??currentSurah}:{}), surahs, lemmas, forms, includeRoots, includePartial, includeNear, showTranslation, translator, occurrence: occurrenceFilter ?? null }
  const linkStateKey = JSON.stringify(linkState)
  useEffect(() => { if (open) { onStateChange?.(JSON.parse(linkStateKey)); setCopyStatus('') } }, [open, linkStateKey, onStateChange])

  const valid = !!occurrenceFilter || normalizeQuranSearch(query).replace(/\s/g, '').length >= 2
  const scopeKey = surahs.join(',')
  const canExpandRoots = occurrenceFilter ? !!occurrenceFilter.root && occurrenceFilter.part !== 'prefix' : !normalizeQuranSearch(query).includes(' ')

  useEffect(() => {
    if (occurrenceFilter && !restored) {
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
    pending.current = key; setCurrentResult(1); setVisible(20); scroll.current = 0; setError(false)
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

  useEffect(() => {
    const container = list.current
    if (!open || busy || error || !valid || !container) return
    const seen = new Set<number>()
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const index = Number((entry.target as HTMLElement).dataset.searchResultIndex)
        if (entry.isIntersecting && entry.intersectionRect.height > 1) seen.add(index)
        else seen.delete(index)
      }
      if (seen.size) setCurrentResult(Math.min(...seen))
    }, { root: container, threshold: [0, 0.01] })
    container.querySelectorAll('[data-search-result-index]').forEach(card => observer.observe(card))
    return () => observer.disconnect()
  }, [open, busy, error, valid, visible, rawResults, lemmas, forms])

  const visibleSurahs = showTranslation && open ? [...new Set(results.slice(0, visible).map(r => r.s))].join(',') : ''
  useEffect(() => {
    if (!visibleSurahs) return
    let live = true
    const numbers = visibleSurahs.split(',').map(Number).filter(n => !translations[n]?.['1']?.[translator])
    for (const s of numbers) loadTrans(s,translator).then(data => {
      if (live) { setTranslations(current => ({ ...current, [s]: data })); setTranslationErrors(current => current.filter(n => n !== s)) }
    }).catch(() => { if (live) setTranslationErrors(current => [...new Set([...current, s])]) })
    return () => { live = false }
  }, [visibleSurahs, translationRetry, translator])

  const toggleFacet = (kind: 'lemmas' | 'forms', value: string) => {
    const setter = kind === 'lemmas' ? setLemmas : setForms
    setter(current => current.includes(value) ? current.filter(x => x !== value) : [...current, value]); setCurrentResult(1); setVisible(20); scroll.current = 0; if (list.current) list.current.scrollTop = 0
  }
  const setScope = (s: number, checked: boolean) => setSurahs(current => checked ? [...current, s].sort((a, b) => a - b) : current.filter(n => n !== s))
  const destinations = mode === 'text' && !occurrenceFilter ? searchDestinations(meta,query,restored?.contextSurah??currentSurah) : []
  const scopeLabel = surahs.length === 0 ? t("ui.5ad7b9b0af") : surahs.length === 1 ? t("ui.0eb0a3f03f",{p0:(meta.surahs[surahs[0] - 1]?.fa)}) : t("ui.bc740afadf",{p0:(toFa(surahs.length))})
  if (!open) return null
  return createPortal(<main ref={page} className="quran-search-page" data-search-page dir={uiDirection()} aria-label={t("ui.cd32ebbeba")} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onOpenChange(false) } }}>
    <div className="search-page-shell">
      <header className="search-page-header">
        <h1 className="sr-only">{t("ui.cd32ebbeba")}</h1>
        <div className="search-command-row">
          <button type="button" className="icon-btn" aria-label={t("ui.685e0d6bc0")} onClick={() => onOpenChange(false)}><ArrowRight size={20} /></button>
          <div className="search-page-input">
            <Search size={17} aria-hidden="true" />
            <DictationInput speechLocale="ar" ref={input} type="search" value={query} maxLength={160} role="combobox" aria-autocomplete="list" aria-expanded={completionOpen && !busy && suggestions.length > 0} aria-controls="search-completions" aria-activedescendant={completionOpen && completionIndex >= 0 ? `search-completion-${completionIndex}` : undefined}
              onFocus={() => setCompletionOpen(true)} onBlur={event => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setCompletionOpen(false) }}
              onChange={event => { if (occurrenceFilter) onClearOccurrenceFilter?.(); setQuery(event.target.value); setCompletionOpen(true); setCompletionIndex(-1) }}
              onKeyDown={event => {
                if (event.key === 'ArrowDown' && !busy && suggestions.length) { event.preventDefault(); setCompletionOpen(true); setCompletionIndex(i => (i + 1) % suggestions.length) }
                else if (event.key === 'ArrowUp' && !busy && suggestions.length) { event.preventDefault(); setCompletionOpen(true); setCompletionIndex(i => (i - 1 + suggestions.length) % suggestions.length) }
                else if (event.key === 'Enter') { event.preventDefault(); if (destinations.length===1&&onNavigate) onNavigate(destinations[0].destination); else if (completionOpen && completionIndex >= 0) setQuery(suggestions[completionIndex]); setCompletionOpen(false); input.current?.blur() }
                else if (event.key === 'Escape' && completionOpen) { event.preventDefault(); event.stopPropagation(); setCompletionOpen(false) }
              }}
              aria-label={mode === 'root' ? t("ui.2f8f10c05a") : mode === 'lemma' ? t("ui.3ccd03be3e") : t("ui.d008c5b1be")} placeholder={occurrenceFilter ? t("ui.de2ec61b2e") : mode === 'root' ? t("ui.726cfb70d6") : mode === 'lemma' ? t("ui.0b020887df") : t("ui.7c498eb144")} autoComplete="off" autoCorrect="off" spellCheck={false} />
            {query && <button type="button" aria-label={t("ui.f37fae1000")} onClick={() => { setQuery(''); input.current?.focus({ preventScroll: true }) }}><X size={15} /></button>}
            {completionOpen && !busy && suggestions.length > 0 && !occurrenceFilter && <div id="search-completions" className="search-completion-menu" role="listbox" aria-label={t("ui.7bf42d2a96")}>{suggestions.map((value, i) => <button type="button" role="option" id={`search-completion-${i}`} aria-selected={completionIndex === i} key={value} onMouseDown={event => event.preventDefault()} onClick={() => { setQuery(value); setCompletionOpen(false); input.current?.blur() }}><Search size={14} /><QuranText text={value} /><span aria-hidden="true">↖</span></button>)}</div>}
          </div>
          <button type="button" className="icon-btn" aria-label={copyStatus || t("ui.8f0d9edc8e")} title={copyStatus || t("ui.8f0d9edc8e")} onClick={async () => {
            try { await navigator.clipboard.writeText(searchLink(process.env.NEXT_PUBLIC_DESKTOP === '1' ? 'https://quran-vajeh.vercel.app' : window.location.href, linkState).href); setCopyStatus(t("ui.dc5c67b8a3")) }
            catch { setCopyStatus(t("ui.7087c79136")) }
          }}>{copyStatus === t("ui.dc5c67b8a3") ? <Check size={18} /> : <Link size={18} />}</button>
          <button type="button" className="icon-btn search-translation-toggle" aria-label={t("ui.37e2fdb79c")} title={t("ui.a35032af94")} aria-pressed={showTranslation} onClick={() => setShowTranslation(value => !value)}><IconTranslate size={20} /></button>
        </div>
        <div className="search-controls-row">
          <div className="search-mode-tabs" role="group" aria-label={t("ui.50ca6c9156")}>{([['text', t("ui.0f4147fe60")], ['root', t("ui.eecfc08eb8")], ['lemma', t("ui.8d5e58ddd8")]] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={mode === key && !occurrenceFilter} onClick={() => { onClearOccurrenceFilter?.(); setSuggestions([]); setMode(key); input.current?.focus({ preventScroll: true }) }}>{label}</button>)}</div>
          {(mode === 'text' || !!occurrenceFilter) && <button type="button" className="search-roots-toggle" aria-pressed={includeRoots && canExpandRoots} disabled={!canExpandRoots} title={!canExpandRoots ? t("ui.a85026f74c") : t("ui.099da0d424")} onClick={() => setIncludeRoots(value => !value)}>{t("ui.702b74fe3e")}</button>}
          <details className="search-scope"><summary aria-label={t("ui.d67a8d9786")}><Funnel size={14} /><span>{scopeLabel}</span></summary>
            <div className="search-scope-panel"><div className="search-scope-shortcuts"><button type="button" onClick={() => setSurahs([])}>{t("ui.5ad7b9b0af")}</button><button type="button" onClick={() => setSurahs([currentSurah])}>{t("ui.35fa085c5c")}</button></div><DictationInput type="search" value={surahQuery} onChange={e => setSurahQuery(e.target.value)} placeholder={t("ui.51b594c97e")} aria-label={t("ui.c8c0719ae1")} /><p>{t("ui.831ac25576")}</p><div className="search-surah-options">{meta.surahs.filter(s => normalizeQuranSearch(`${s.fa} ${s.ar} ${s.n} ${toFa(s.n)}`).includes(normalizeQuranSearch(surahQuery))).map(s => <label className="choice-row" key={s.n}><input type="checkbox" checked={surahs.includes(s.n)} onChange={event => setScope(s.n, event.target.checked)} /><span>{toFa(s.n)} · {s.fa}</span></label>)}</div></div>
          </details>
          <details className="search-extra-options"><summary aria-label={t("ui.ba7db1f34f")}><MoreVertical size={19} /></summary><div>
            <label className="choice-row"><input type="checkbox" checked={includePartial} disabled={!!occurrenceFilter || mode !== 'text'} onChange={e => setIncludePartial(e.target.checked)} />{t("ui.5105840a21")}</label>
            <label className="choice-row"><input type="checkbox" checked={includeNear} disabled={!!occurrenceFilter || mode !== 'text'} onChange={e => setIncludeNear(e.target.checked)} />{t("ui.8a8b5ac72e")}</label>
          </div></details>
        </div>
        {includeNear && mode === 'text' && <button type="button" className="search-active-filter" aria-label={t("ui.74ae9ec1c4")} onClick={() => setIncludeNear(false)}>{t("ui.36ee5635ee")}{' '}<X size={12} /></button>}
        {occurrenceFilter && <div className="search-active-filter"><span>{includeRoots && canExpandRoots ? t("ui.0b6f9a295b",{p0:(occurrenceFilter.root ?? '')}) : occurrenceFilter.tab === 'form' ? t("ui.b87b342872",{p0:(occurrenceFilter.form),p1:(occurrenceFilter.root ?? '')}) : t("ui.108e40c64f",{p0:(occurrenceFilter.text)})}</span><button type="button" aria-label={t("ui.96ad94b293")} onClick={onClearOccurrenceFilter}><X size={14} /></button></div>}
      </header>
      {onNavigate&&destinations.length>0&&<div className="search-jump-options" aria-label={t("ui.d289fa208b")}>{destinations.map((item,i)=><button type="button" key={i} onClick={()=>onNavigate(item.destination)}>{t("ui.b7b6972c78")}{' '}{toFa(item.label)} ←</button>)}</div>}
      <div className="search-results-summary">
        <div role="status" aria-live="polite">{busy ? <span><LoaderCircle size={15} className="animate-spin" />{t("ui.63509f3da4")}</span> : !valid ? t("ui.4bfc7b8a3d") : error ? t("ui.12287cefbb") : <><strong className="search-results-total">{t('search.totalResults', { total: results.length })}</strong><span className="search-results-detail">{t("ui.9ec9176e66",{p0:(toFa(results.length)),p1:(toFa(results.reduce((sum, r) => sum + r.positions.length, 0)))})}</span></>}</div>
        {!busy && !error && valid && results.length > 0 && <span className="search-results-position" data-current-result={Math.min(currentResult, results.length)} data-total-results={results.length} aria-live="off">{t('search.resultPosition', { current: Math.min(currentResult, results.length), total: results.length })}</span>}
      </div>
      <div ref={list} className="search-page-results nice-scroll" tabIndex={-1} aria-label={t("ui.57f03a82b0")} aria-busy={busy} onScroll={event => { scroll.current = event.currentTarget.scrollTop }}>
        {!busy && rawResults.length > 0 && <div className="search-facets-inline" aria-label={t("ui.07093a152e")}>
          {(['forms', 'lemmas'] as const).map(kind => <SearchFacetGroup key={`${mode}:${query}:${kind}`} kind={kind} formLabels={formLabels} counts={searchFacetCounts(rawResults, facets, kind)} selected={facets[kind]} onToggle={value => toggleFacet(kind, value)} />)}
          {(lemmas.length > 0 || forms.length > 0) && <div className="search-active-facets">{(['forms', 'lemmas'] as const).flatMap(kind => facets[kind].map(value => <button type="button" key={`${kind}:${value}`} aria-label={t("ui.96ba59563f",{p0:(kind === 'forms' ? formLabels.get(value)?.label ?? morphologyLabel(value) : lemmaDisplay(value))})} onClick={() => toggleFacet(kind, value)}>{kind === 'forms' ? formLabels.get(value)?.label ?? morphologyLabel(value) : lemmaDisplay(value)}<X size={12} /></button>))}<button type="button" onClick={() => { setLemmas([]); setForms([]) }}>{t("ui.1c36b0e132")}</button></div>}
        </div>}
        {!valid && <div className="search-empty"><BookOpen size={34} /><h2>{t("ui.2c2cdb504e")}</h2><p>{t("ui.9535464700")}</p><div>{[t("ui.cfd7c4bd1f"), t("ui.72dbd6c944"), t("ui.e7e17d45e9")].map(text => <button type="button" key={text} onClick={() => setQuery(text)}>{text}</button>)}</div></div>}
        {error && <button type="button" className="chip" onClick={() => setRetry(value => value + 1)}>{t("ui.be9b8b4f2b")}</button>}
        {!busy && !error && valid && !results.length && <div className="search-empty"><Search size={30} /><h2>{t("ui.b548ad6007")}</h2><p>{t("ui.d0c738e420")}</p></div>}
        {!busy && !error && valid && results.slice(0, visible).map((result, index) => <div key={`${result.s}:${result.a}`}>
          {!occurrenceFilter && (index === 0 || results[index - 1].kind !== result.kind) && <h2 className="search-result-group">{t(labels[result.kind])}{' · '}{t('search.totalResults', { total: results.filter(item => item.kind === result.kind).length })}</h2>}
          <article className="search-result-card" data-search-result-index={index + 1}><button type="button" className="search-result-open" aria-label={t("ui.a55b5ca0c4",{p0:(meta.surahs[result.s - 1]?.fa),p1:(toFa(result.a))})} onClick={() => { scroll.current = list.current?.scrollTop ?? scroll.current; onPick(result.s, result.a, result.positions[0] ?? 1) }}>
            <span className="search-result-meta"><b>{meta.surahs[result.s - 1]?.fa}{' '}{t("ui.f922b82cb1")}{' '}{toFa(result.a)}</b><span className="search-result-position">{t('search.resultPosition', { current: index + 1, total: results.length })}</span><span>{t("ui.1abf27acd0")}</span></span><span className="search-result-text font-quran" lang="ar">{snippet(result, true)}</span>
          </button>
          {showTranslation && <div className="search-result-translation" dir={translationDirection(translator)} lang={translationLanguage(translator)}>{translations[result.s]?.[String(result.a)]?.[translator] ?? (translationErrors.includes(result.s) ? <button type="button" onClick={() => setTranslationRetry(n => n + 1)}>{t("ui.76f0fc62b1")}</button> : <span role="status">{t("ui.ad34b65e87")}</span>)}</div>}
          </article>
        </div>)}
        {!busy && valid && visible < results.length && <button type="button" className="search-more" onClick={() => setVisible(count => count + 20)}>{t("ui.0c70162476")}{' '}{toFa(visible)}{' '}{t("ui.77e7a9224b")}{' '}{toFa(results.length)}</button>}
      </div>
    </div>
  </main>, document.body)
}


function SearchFacetGroup({ kind, counts, selected, onToggle, formLabels }: {
  formLabels: Map<string, { label: string; description: string }>; kind: 'forms' | 'lemmas'; counts: { value: string; count: number }[]; selected: string[]; onToggle: (value: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  if (!counts.length) return null
  return <div className="search-facet-row" role="group" aria-label={kind === 'forms' ? t("ui.314d58e669") : t("ui.1dc4cae4ed")}>
    <span>{kind === 'forms' ? t("ui.12706fd406") : t("ui.8d5e58ddd8")}</span><div>{(expanded ? counts : counts.slice(0, 3)).map(({ value, count }) => <button type="button" key={value} aria-pressed={selected.includes(value)} title={kind === 'forms' ? formLabels.get(value)?.description ?? morphologyLabel(value) : undefined} onClick={() => onToggle(value)}><span>{kind === 'forms' ? formLabels.get(value)?.label ?? morphologyLabel(value) : <QuranText text={lemmaDisplay(value)} />}</span><small>{toFa(count)}</small></button>)}
    {counts.length > 3 && <button type="button" className="search-facet-more" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? t("ui.a023ed0970") : t("ui.9b083d9135",{p0:(toFa(counts.length - 3))})}</button>}</div>
  </div>
}
