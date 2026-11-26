'use client'
import QuranHighlight from './QuranHighlight'
import {DictationInput} from './DictationInput'
import {translationDirection,translationLanguage} from '@/lib/translations'
import {t,uiDirection} from '@/lib/i18n'

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import {IconTranslate} from './Ornaments'
import { Search, X, LoaderCircle, ArrowRight, Funnel, BookOpen, MoreVertical, Link, Check, Languages, SpellCheck } from 'lucide-react'
import type { Meta, Translator, Translations } from '@/lib/quran'
import { loadTrans, toFa, morphologyLabel } from '@/lib/quran'
import { type AnalysisSelection } from '@/lib/analysis'
import { countQuranSearchResults, normalizeQuranSearch, type QuranSearchHighlight, type QuranSearchResult } from '@/lib/quran-search'
import QuranText from './QuranText'
import { splitWord } from '@/lib/word-parts'
import type { SearchMode } from '@/lib/quran-search-session'
import { createQuranSearchWorker } from '@/lib/quran-search-client'
import { defaultPhase3SearchOptions } from '@/lib/search-query'
import { lemmaDisplay } from '@/lib/lemma-display'
import { searchFormLabels } from '@/lib/search-form-labels'
import DestinationOptions, { useDestinationSelection } from './DestinationOptions'
import { searchDestinations, isNavigationInput, type Destination } from '@/lib/navigation'
import type { VerseAddress } from '@/lib/verse-link'
import { SEARCH_AND_GO_PHASE_2, SEARCH_AND_GO_PHASE_3, searchLink, type SearchScopeVariant, type SearchPhase3State, type SearchLinkState, type SearchResultPosition } from '@/lib/search-link'
import { filterSearchFacets, searchFacetCounts } from '@/lib/search-facets'
import SearchFilterRow from './SearchFilterRow'
import { readStored, writeStored } from '@/lib/reader-storage'
import SearchPhase3Controls, { SearchWorkspaceSettings, SearchWorkspaceSort } from './SearchPhase3Controls'
import SearchWorkspaceScope from './SearchWorkspaceScope'
import { readSearchScope, scopeSurahs, searchScopeStorage, type SearchScopeSelection } from '@/lib/search-scope'
import { useDismissiblePanel } from './useDismissiblePanel'
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
  inline?: {
    query: string
    position?: SearchResultPosition
    unified?: {
      run: boolean
      controls: boolean
      input: RefObject<HTMLInputElement | null>
      settingsHost: HTMLDivElement | null
      researchHost: HTMLElement | null
      selected?: VerseAddress
      onSuggestions: (suggestions: string[]) => void
      onModeChange: (mode: SearchMode) => void
    }
  }
  onPick: (s: number, a: number, pos: number, state: SearchLinkState, position: SearchResultPosition, highlight?: QuranSearchHighlight) => void
}
const emptyResults: QuranSearchResult[] = []

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
  return <>{from > 0 && '… '}{runs.map((run, i) => <span key={i}>{run.selected ? <QuranHighlight text={run.words.join(' ')} /> : <QuranText text={run.words.join(' ')} />}{i < runs.length - 1 ? ' ' : null}</span>)}{to < result.words.length && ' …'}</>
}
const labels = { exact: t("ui.e3aee9c005"), partial: t("ui.b3541360ab"), near: t("ui.8a95e90fb6"), root: t("ui.702b74fe3e") }

export default function QuranSearch({ open, onOpenChange, meta, currentSurah, onPick, occurrenceFilter, onClearOccurrenceFilter, translator, initialSearch, onStateChange, onNavigate, inline }: Props) {
  const restored = initialSearch?.state
  const unified = inline?.unified
  const phase3 = SEARCH_AND_GO_PHASE_3 && !!unified
  const [searchOrigin] = useState(restored?.contextSurah ?? currentSurah)
  const [initialScope] = useState<SearchScopeSelection>(() => {
    const explicit = restored?.surahs ?? initialSearch?.surahs ?? []
    if (restored?.scopeVariant || explicit.length) return { variant: restored?.scopeVariant ?? 'selected', surahs: explicit }
    return phase3 ? readSearchScope() : { variant: 'all', surahs: [] }
  })
  const [scopeVariant, setScopeVariant] = useState<SearchScopeVariant>(initialScope.variant)
  const [config, setConfig] = useState<SearchPhase3State>(() => restored?.phase3 ?? {
    ...defaultPhase3SearchOptions(), lemmas: restored?.lemmas ?? [], forms: restored?.forms ?? [],
  })
  const [copyStatus, setCopyStatus] = useState('')
  const [ownQuery, setQuery] = useState(restored?.query ?? initialSearch?.query ?? '')
  const query = inline?.query ?? ownQuery
  const [mode, setMode] = useState<SearchMode>(restored?.mode ?? initialSearch?.mode ?? 'text')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [completionOpen, setCompletionOpen] = useState(false)
  const [completionIndex, setCompletionIndex] = useState(-1)
  const [lemmas, setLemmas] = useState<string[]>(restored?.lemmas ?? [])
  const [forms, setForms] = useState<string[]>(restored?.forms ?? [])
  const [includePartial, setIncludePartial] = useState(restored?.includePartial ?? true)
  const [includeNear, setIncludeNear] = useState(restored?.includeNear ?? false)
  const [includeRoots, setIncludeRoots] = useState(() => phase3 && !restored?.query && !restored?.occurrence && !restored?.phase3 ? readStored('mushaf.search-roots.v1', false) : restored?.includeRoots ?? !unified)
  const toggleRoots = () => {
    const next = !includeRoots
    setIncludeRoots(next)
    if (phase3) writeStored('mushaf.search-roots.v1', next)
  }
  const [surahs, setSurahs] = useState<number[]>(() => {
    const initialSurahs = restored?.surahs ?? initialSearch?.surahs ?? []
    return phase3 ? scopeSurahs(meta, searchOrigin, scopeVariant, initialScope.surahs) : initialSurahs
  })
  const [countsActive, setCountsActive] = useState(false)
  const [scopeCountAnswer, setScopeCountAnswer] = useState<{ key: string; counts: Record<number, number>; error?: boolean } | null>(null)
  const scopeCountWorker = useRef<Worker | null>(null)
  const changeWorkspaceScope = (selection: SearchScopeSelection) => {
    setScopeVariant(selection.variant)
    setSurahs(selection.surahs)
    writeStored(searchScopeStorage, selection)
  }
  const [surahQuery, setSurahQuery] = useState('')
  const [scopeOpen, setScopeOpen] = useState(false)
  const [extraOptionsOpen, setExtraOptionsOpen] = useState(false)
  const [showTranslation, setShowTranslation] = useState(restored?.showTranslation ?? false)
  const [translations, setTranslations] = useState<Record<number, Translations>>({})
  const [translationErrors, setTranslationErrors] = useState<number[]>([])
  const [translationRetry, setTranslationRetry] = useState(0)
  const [rawResults, setResults] = useState<QuranSearchResult[]>([])
  const [working, setBusy] = useState(!!inline && open)
  const [answerKey, setAnswerKey] = useState('')
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [visible, setVisible] = useState(inline?.position?.visible ?? 20)
  const [currentResult, setCurrentResult] = useState(1)
  const page = useRef<HTMLElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const scroll = useRef(0)
  const restoreInline = useRef(inline?.position)
  const controlsInput = unified?.input ?? input
  const dismissScope = useCallback(() => setScopeOpen(false), [])
  const dismissExtraOptions = useCallback(() => setExtraOptionsOpen(false), [])
  const scopePanel = useDismissiblePanel<HTMLDetailsElement>(scopeOpen, dismissScope)
  const extraOptionsPanel = useDismissiblePanel<HTMLDetailsElement>(extraOptionsOpen, dismissExtraOptions)
  const worker = useRef<Worker | null>(null)
  const request = useRef(0)
  const completed = useRef('')
  const pending = useRef('')
  const facets = { lemmas, forms }
  const formLabels = useMemo(() => searchFormLabels(rawResults), [rawResults])
  const results = useMemo(() => phase3 ? rawResults : filterSearchFacets(rawResults, { lemmas, forms }), [phase3, rawResults, lemmas, forms])
  const counts = useMemo(() => countQuranSearchResults(results), [results])
  const groupCounts = useMemo(() => {
    const counts = { exact: 0, partial: 0, near: 0, root: 0 }
    for (const result of results) counts[result.kind]++
    return counts
  }, [results])
  const facetIdentity = JSON.stringify([query, mode, includeRoots, occurrenceFilter, surahs])
  // Changing the search identity (query, mode, filters, scope) drops the facet
  // selections so stale filters never follow the reader into a new search.
  // Adjusting state here during render — instead of in an effect — also means
  // the old facets never filter the new results for a single frame.
  const [seenFacetIdentity, setSeenFacetIdentity] = useState(facetIdentity)
  if (seenFacetIdentity !== facetIdentity) {
    setSeenFacetIdentity(facetIdentity)
    setLemmas([])
    setForms([])
  }
  const linkState: SearchLinkState = { query, mode, ...(isNavigationInput(query)?{contextSurah:restored?.contextSurah??currentSurah}:{}), surahs, lemmas, forms, includeRoots, includePartial, includeNear, showTranslation, translator, occurrence: occurrenceFilter ?? null, ...(phase3 ? { contextSurah: searchOrigin, scopeVariant, phase3: config } : {}) }
  const linkStateKey = JSON.stringify(linkState)
  // The copy-link feedback is dropped whenever the search state changes while
  // the page is open — adjusted here during render instead of inside the
  // parent-sync effect below, so the stale "copied" chip never paints for a
  // frame (and the effect keeps only the external synchronization).
  const copyResetKey = `${open}:${linkStateKey}`
  const [seenCopyResetKey, setSeenCopyResetKey] = useState(copyResetKey)
  if (seenCopyResetKey !== copyResetKey) {
    setSeenCopyResetKey(copyResetKey)
    if (open) setCopyStatus('')
  }
  useEffect(() => { if (open) onStateChange?.(JSON.parse(linkStateKey)) }, [open, linkStateKey, onStateChange])

  const valid = !!occurrenceFilter || normalizeQuranSearch(query).replace(/\s/g, '').length >= 2
  const canExpandRoots = occurrenceFilter ? !!occurrenceFilter.root && occurrenceFilter.part !== 'prefix' : !normalizeQuranSearch(query).includes(' ')

  // A newly handed-over occurrence filter retunes the search options (it has
  // its own criterion, so near-matches are off, root-expansion follows the
  // filter's tab, and the query is emptied). Adjusted here during render
  // instead of in an effect, so a mount with a filter never paints the untuned
  // state; `undefined` as the initial "seen" value makes a mount WITH a filter
  // act, exactly like the effect did, while a mount without one stays put.
  const searchOpen = open && (unified?.run ?? true)
  const engineKey = JSON.stringify({ query, options: { mode, includePartial, includeNear, includeRoots: includeRoots && (phase3 || canExpandRoots), surahs, ...(phase3 ? { phase3: config } : {}) }, filter: occurrenceFilter, emptyScope: phase3 && scopeVariant === 'selected' && !surahs.length })
  const busy = !!unified && searchOpen && valid && answerKey !== engineKey || working
  const scopeCountKey = countsActive && valid ? JSON.stringify({
    query, options: { mode, includePartial, includeNear, includeRoots, phase3: { ...config, sorts: ['mushaf'], reverseSort: false } },
    filter: occurrenceFilter,
  }) : ''
  const activeScopeAnswer = scopeCountAnswer?.key === scopeCountKey ? scopeCountAnswer : null
  const scopeCounts = !valid ? {} : activeScopeAnswer?.counts ?? null
  useEffect(() => () => scopeCountWorker.current?.terminate(), [])
  useEffect(() => {
    if (!scopeCountKey) return
    const timer = setTimeout(() => {
      try {
        const countWorker = scopeCountWorker.current ??= createQuranSearchWorker()
        countWorker.onmessage = (event: MessageEvent<{ key: string; counts?: Record<number, number>; error?: boolean }>) => {
          if (event.data.key === scopeCountKey) setScopeCountAnswer({ key: scopeCountKey, counts: event.data.counts ?? {}, error: event.data.error })
        }
        countWorker.onerror = () => setScopeCountAnswer({ key: scopeCountKey, counts: {}, error: true })
        countWorker.postMessage({ id: 0, ...JSON.parse(scopeCountKey), countsKey: scopeCountKey })
      } catch { setScopeCountAnswer({ key: scopeCountKey, counts: {}, error: true }) }
    }, 100)
    return () => {
      clearTimeout(timer)
      if (scopeCountWorker.current) scopeCountWorker.current.onmessage = null
    }
  }, [scopeCountKey])
  const onSuggestions = unified?.onSuggestions
  useEffect(() => {
    if (onSuggestions) onSuggestions(searchOpen && !busy && !error && valid && answerKey === engineKey ? suggestions : [])
  }, [answerKey, busy, engineKey, error, onSuggestions, searchOpen, suggestions, valid])

  const [seenOccurrence, setSeenOccurrence] = useState<AnalysisSelection | null | undefined>(occurrenceFilter === null ? null : undefined)
  if (seenOccurrence !== occurrenceFilter) {
    setSeenOccurrence(occurrenceFilter)
    if (occurrenceFilter && !restored) { setIncludeNear(false); setIncludeRoots(occurrenceFilter.tab === 'root'); setQuery('') }
  }
  useEffect(() => () => worker.current?.terminate(), [])
  useEffect(() => {
    if (!SEARCH_AND_GO_PHASE_2 || inline || !navigator.serviceWorker) return
    // Cache the generated Worker module with the service worker, even when
    // the first search happens after an offline reload. Indexing stays lazy.
    let preload: Worker | undefined
    const warmup = () => {
      if (!navigator.serviceWorker.controller || preload) return
      try {
        preload = createQuranSearchWorker()
        preload.onmessage = preload.onerror = () => preload?.terminate()
        preload.postMessage({ warmup: true })
      } catch { /* Loading without a cached worker is handled when searching. */ }
    }
    warmup()
    navigator.serviceWorker.addEventListener('controllerchange', warmup)
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', warmup)
      preload?.terminate()
    }
  }, [!!inline])
  useEffect(() => {
    if (!open || inline) return
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
    if (!searchOpen) { request.current++; return }
    const id = ++request.current
    const key = engineKey
    if (!error && completed.current === key) { setBusy(false); return }
    if (!inline?.position) restoreInline.current = undefined
    pending.current = key; setCurrentResult(1); setVisible(restoreInline.current?.visible ?? 20); scroll.current = 0; setError(false)
    if (list.current) list.current.scrollTop = 0
    if (!valid && (inline || normalizeQuranSearch(query).length === 0)) { completed.current = ''; setResults([]); setSuggestions([]); setBusy(false); return }
    setBusy(true)
    const timer = setTimeout(() => {
      try {
        if (!worker.current) {
          worker.current = createQuranSearchWorker()
          worker.current.onmessage = (event: MessageEvent<{ id: number; results?: QuranSearchResult[]; suggestions?: string[]; error?: boolean }>) => {
            if (event.data.id !== request.current) return
            completed.current = event.data.error ? '' : pending.current
            setAnswerKey(pending.current)
            setResults(event.data.results ?? []); setSuggestions(event.data.suggestions ?? []); setCompletionIndex(-1); setError(!!event.data.error); setBusy(false)
          }
          worker.current.onerror = () => { setAnswerKey(pending.current); setError(true); setBusy(false); worker.current?.terminate(); worker.current = null }
        }
        worker.current.postMessage({ id, ...JSON.parse(key), phase2: !!unified })
      } catch { setAnswerKey(key); setError(true); setBusy(false) }
    }, 100)
    return () => { clearTimeout(timer); request.current++ }
  }, [engineKey, valid, retry, searchOpen, unified !== undefined])

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

  const settingsOpen = !!unified?.controls
  useEffect(() => {
    if (!settingsOpen && list.current && scroll.current) list.current.scrollTop = scroll.current
  }, [settingsOpen])

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

  const restoringTranslations = !!unified && !!visibleSurahs && visibleSurahs.split(',').map(Number)
    .some(s => !translations[s]?.['1']?.[translator] && !translationErrors.includes(s))
  useEffect(() => {
    const position = restoreInline.current
    if (!position || busy || error || !rawResults.length || !list.current || restoringTranslations) return
    const container = list.current
    const place = () => {
      const anchor = position.anchor
      const card = anchor && container.querySelector<HTMLElement>(`[data-search-address="${anchor.s}:${anchor.a}"]`)
      if (card && anchor) container.scrollTop += card.getBoundingClientRect().top - container.getBoundingClientRect().top - anchor.offset
      else container.scrollTop = position.scrollTop
      restoreInline.current = undefined
    }
    if (!unified) { place(); return }
    let cancelled = false
    let frame = 0
    document.fonts.ready.then(() => {
      if (!cancelled) frame = requestAnimationFrame(place)
    })
    return () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [busy, error, rawResults, restoringTranslations, unified !== undefined])

  const toggleFacet = (kind: 'lemmas' | 'forms', value: string) => {
    const setter = kind === 'lemmas' ? setLemmas : setForms
    setter(current => current.includes(value) ? current.filter(x => x !== value) : [...current, value]); setCurrentResult(1); setVisible(20); scroll.current = 0; if (list.current) list.current.scrollTop = 0
  }
  const setScope = (s: number, checked: boolean) => setSurahs(current => checked ? [...current, s].sort((a, b) => a - b) : current.filter(n => n !== s))
  const destinations = onNavigate && mode === 'text' && !occurrenceFilter ? searchDestinations(meta,query,restored?.contextSurah??currentSurah) : []
  const destinationSelection = useDestinationSelection(destinations)
  const scopeLabel = surahs.length === 0 ? t("ui.5ad7b9b0af") : surahs.length === 1 ? t("ui.0eb0a3f03f",{p0:(meta.surahs[surahs[0] - 1]?.fa)}) : t("ui.bc740afadf",{p0:(toFa(surahs.length))})
  if (!open) return null
  const capturePosition = (): SearchResultPosition => {
    const container = list.current
    if (!container) return { scrollTop: scroll.current, visible }
    scroll.current = container.scrollTop
    const position: SearchResultPosition = { scrollTop: scroll.current, visible }
    if (!unified) return position
    const top = container.getBoundingClientRect().top
    const card = Array.from(container.querySelectorAll<HTMLElement>('[data-search-address]')).find(element => element.getBoundingClientRect().bottom > top)
    if (card) {
      const [s, a] = card.dataset.searchAddress!.split(':').map(Number)
      position.anchor = { s, a, offset: card.getBoundingClientRect().top - top }
    }
    return position
  }
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(searchLink(process.env.NEXT_PUBLIC_DESKTOP === '1' ? 'https://quran-vajeh.vercel.app' : window.location.href, linkState).href)
      setCopyStatus(t("ui.dc5c67b8a3"))
    } catch { setCopyStatus(t("ui.7087c79136")) }
  }
  const commonActions = <>
    <button type="button" className="icon-btn" aria-label={copyStatus || t("ui.8f0d9edc8e")} title={copyStatus || t("ui.8f0d9edc8e")} onClick={copyLink}>{copyStatus === t("ui.dc5c67b8a3") ? <Check size={18} /> : <Link size={18} />}</button>
    <button type="button" className="icon-btn search-translation-toggle" aria-label={t("ui.37e2fdb79c")} title={t("ui.a35032af94")} aria-pressed={showTranslation} onClick={() => setShowTranslation(value => !value)}><IconTranslate size={20} /></button>
  </>
  const facetControls = !busy && rawResults.length > 0 && <div className="search-facets-inline" aria-label={t("ui.07093a152e")}>
          {(['forms', 'lemmas'] as const).map(kind => <SearchFilterRow key={`${mode}:${query}:${kind}`}
            label={t(kind === 'forms' ? 'ui.12706fd406' : 'ui.8d5e58ddd8')}
            ariaLabel={t(kind === 'forms' ? 'ui.314d58e669' : 'ui.1dc4cae4ed')}
            options={searchFacetCounts(rawResults, facets, kind).map(({value,count}) => ({
              value, count,
              label: kind === 'forms' ? formLabels.get(value)?.label ?? morphologyLabel(value) : <QuranText text={lemmaDisplay(value)} />,
              title: kind === 'forms' ? formLabels.get(value)?.description ?? morphologyLabel(value) : undefined,
            }))}
            selected={facets[kind]} onToggle={value => toggleFacet(kind, value)} />)}
          {(lemmas.length > 0 || forms.length > 0) && <div className="search-active-facets">{(['forms', 'lemmas'] as const).flatMap(kind => facets[kind].map(value => <button type="button" key={`${kind}:${value}`} aria-label={t("ui.96ba59563f",{p0:(kind === 'forms' ? formLabels.get(value)?.label ?? morphologyLabel(value) : lemmaDisplay(value))})} onClick={() => toggleFacet(kind, value)}>{kind === 'forms' ? formLabels.get(value)?.label ?? morphologyLabel(value) : lemmaDisplay(value)}<X size={12} /></button>))}<button type="button" onClick={() => { setLemmas([]); setForms([]) }}>{t("ui.1c36b0e132")}</button></div>}
        </div>
  const matchingPreferences = [
    { label: t('ui.5105840a21'), checked: includePartial, disabled: !!occurrenceFilter || mode !== 'text', onChange: setIncludePartial },
    { label: t('ui.8a8b5ac72e'), checked: includeNear && !(phase3 && config.spellingSensitive),
      disabled: !!occurrenceFilter || mode !== 'text' || (phase3 && config.spellingSensitive), onChange: setIncludeNear },
  ]
  const matchingOptions = matchingPreferences.map(({ label, checked, disabled, onChange }) =>
    <label className="choice-row" key={label}><input type="checkbox" checked={checked} disabled={disabled}
      onChange={event => onChange(event.target.checked)} />{label}</label>)
  const controls = phase3 && <SearchPhase3Controls
        query={query} researchHost={unified?.researchHost} identity={JSON.stringify([query, surahs, mode, config.relation, config.cooccurrence, config.spellingSensitive, config.orderedWords, includeRoots, includePartial, includeNear])}
        config={config}
        results={answerKey === engineKey && !busy ? rawResults : emptyResults} includeRoots={includeRoots} onRoots={toggleRoots} onConfig={setConfig}
      />
  const content = <>
      {controls}
      {(!inline || unified?.controls) && <>
      <div className={inline ? "search-and-go-controls" : "search-page-header"}>
        {!inline && <>
        <h1 className="sr-only">{t("ui.cd32ebbeba")}</h1>
        <div className="search-command-row">
          <button type="button" className="icon-btn" aria-label={t("ui.685e0d6bc0")} onClick={() => onOpenChange(false)}><ArrowRight size={20} /></button>
          <div className="search-page-input">
            <Search size={17} aria-hidden="true" />
            <DictationInput speechLocale="ar" ref={input} type="search" value={query} maxLength={160}
              {...(destinations.length ? destinationSelection.inputProps : {
                role: 'combobox', 'aria-autocomplete': 'list',
                'aria-expanded': completionOpen && !busy && suggestions.length > 0,
                'aria-controls': completionOpen && !busy && suggestions.length ? 'search-completions' : undefined,
                'aria-activedescendant': completionOpen && completionIndex >= 0 ? `search-completion-${completionIndex}` : undefined,
              })}
              onFocus={() => setCompletionOpen(true)} onBlur={event => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setCompletionOpen(false) }}
              onChange={event => { if (occurrenceFilter) onClearOccurrenceFilter?.(); setQuery(event.target.value); destinationSelection.reset(); setCompletionOpen(true); setCompletionIndex(-1) }}
              onKeyDown={event => {
                if (event.nativeEvent.isComposing || destinationSelection.move(event)) return
                if (event.key === 'ArrowDown' && !busy && suggestions.length) { event.preventDefault(); setCompletionOpen(true); setCompletionIndex(i => (i + 1) % suggestions.length) }
                else if (event.key === 'ArrowUp' && !busy && suggestions.length) { event.preventDefault(); setCompletionOpen(true); setCompletionIndex(i => (i - 1 + suggestions.length) % suggestions.length) }
                else if (event.key === 'Enter') { event.preventDefault(); if (destinationSelection.destination && onNavigate) onNavigate(destinationSelection.destination); else if (!destinations.length && completionOpen && suggestions[completionIndex]) setQuery(suggestions[completionIndex]); setCompletionOpen(false); input.current?.blur() }
                else if (event.key === 'Escape' && completionOpen) { event.preventDefault(); event.stopPropagation(); setCompletionOpen(false) }
              }}
              aria-label={mode === 'root' ? t("ui.2f8f10c05a") : mode === 'lemma' ? t("ui.3ccd03be3e") : t("ui.d008c5b1be")} placeholder={occurrenceFilter ? t("ui.de2ec61b2e") : mode === 'root' ? t("ui.726cfb70d6") : mode === 'lemma' ? t("ui.0b020887df") : t("ui.7c498eb144")} autoComplete="off" autoCorrect="off" spellCheck={false} />
            {query && <button type="button" aria-label={t("ui.f37fae1000")} onClick={() => { setQuery(''); input.current?.focus({ preventScroll: true }) }}><X size={15} /></button>}
            {!destinations.length && completionOpen && !busy && suggestions.length > 0 && !occurrenceFilter && <div id="search-completions" className="search-completion-menu" role="listbox" aria-label={t("ui.7bf42d2a96")}>{suggestions.map((value, i) => <button type="button" role="option" id={`search-completion-${i}`} aria-selected={completionIndex === i} key={value} onMouseDown={event => event.preventDefault()} onClick={() => { setQuery(value); setCompletionOpen(false); input.current?.blur() }}><Search size={14} /><QuranText text={value} /><span aria-hidden="true">↖</span></button>)}</div>}
          </div>
          {commonActions}
        </div>
        </>}
        <div className="search-controls-row">
          {!phase3 && <div className="search-mode-tabs" role="group" aria-label={t("ui.50ca6c9156")}>{([['text', t("ui.0f4147fe60")], ['root', t("ui.eecfc08eb8")], ['lemma', t("ui.8d5e58ddd8")]] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={mode === key && !occurrenceFilter} onClick={() => { onClearOccurrenceFilter?.(); setSuggestions([]); setMode(key); unified?.onModeChange(key); if (!unified) controlsInput.current?.focus({ preventScroll: true }) }}>{label}</button>)}</div>}
          {(!phase3 || !!occurrenceFilter) && (mode === 'text' || !!occurrenceFilter) && <button type="button" className="search-roots-toggle" aria-pressed={includeRoots && canExpandRoots} disabled={!canExpandRoots} title={!canExpandRoots ? t("ui.a85026f74c") : t("ui.099da0d424")} onClick={toggleRoots}>{t("ui.702b74fe3e")}</button>}
          {!phase3 && <details ref={scopePanel} open={scopeOpen} onToggle={event => setScopeOpen(event.currentTarget.open)} className="search-scope"><summary aria-label={t("ui.d67a8d9786")}><Funnel size={14} /><span>{scopeLabel}</span></summary>
            <div className="search-scope-panel"><div className="search-scope-shortcuts"><button type="button" onClick={() => setSurahs([])}>{t("ui.5ad7b9b0af")}</button><button type="button" onClick={() => setSurahs([currentSurah])}>{t("ui.35fa085c5c")}</button></div><DictationInput type="search" value={surahQuery} onChange={e => setSurahQuery(e.target.value)} placeholder={t("ui.51b594c97e")} aria-label={t("ui.c8c0719ae1")} /><p>{t("ui.831ac25576")}</p><div className="search-surah-options">{meta.surahs.filter(s => normalizeQuranSearch(`${s.fa} ${s.ar} ${s.n} ${toFa(s.n)}`).includes(normalizeQuranSearch(surahQuery))).map(s => <label className="choice-row" key={s.n}><input type="checkbox" checked={surahs.includes(s.n)} onChange={event => setScope(s.n, event.target.checked)} /><span>{toFa(s.n)} · {s.fa}</span></label>)}</div></div>
          </details>}
          {!phase3 && <details ref={extraOptionsPanel} open={extraOptionsOpen} onToggle={event => setExtraOptionsOpen(event.currentTarget.open)} className="search-extra-options"><summary aria-label={t("ui.ba7db1f34f")}><MoreVertical size={19} /></summary><div>
            {matchingOptions}
          </div></details>}
          {unified && !phase3 && commonActions}
        </div>
        {includeNear && mode === 'text' && <button type="button" className="search-active-filter" aria-label={t("ui.74ae9ec1c4")} onClick={() => setIncludeNear(false)}>{t("ui.36ee5635ee")}{' '}<X size={12} /></button>}
        {occurrenceFilter && <div className="search-active-filter"><span>{includeRoots && canExpandRoots ? t("ui.0b6f9a295b",{p0:(occurrenceFilter.root ?? '')}) : occurrenceFilter.tab === 'form' ? t("ui.b87b342872",{p0:(occurrenceFilter.form),p1:(occurrenceFilter.root ?? '')}) : t("ui.108e40c64f",{p0:(occurrenceFilter.text)})}</span><button type="button" aria-label={t("ui.96ad94b293")} onClick={onClearOccurrenceFilter}><X size={14} /></button></div>}
      </div>
      {unified?.controls && !phase3 && facetControls}
      {onNavigate && <DestinationOptions id={destinationSelection.id} active={destinationSelection.active} options={destinations} onPick={onNavigate} className="search-jump-options" />}
      </>}
      {(!unified || (unified.run && !unified.controls)) && <>
      <div className="search-results-summary">
        <div role="status" aria-live="polite">{busy ? <span><LoaderCircle size={15} className="animate-spin" />{t("ui.63509f3da4")}</span> : !valid ? t("ui.4bfc7b8a3d") : error ? t("ui.12287cefbb") : <>
          {!phase3 && <strong className="search-results-total">{t('search.totalResults', { total: results.length })}</strong>}
          <span className={phase3 ? "search-results-total" : "search-results-detail"}>{t(unified && !phase3 ? "search.occurrenceCount" : "ui.9ec9176e66", { p0: toFa(counts.verses), p1: toFa(unified && !phase3 ? counts.occurrences : counts.words) })}</span>
        </>}</div>
        {!phase3 && !busy && !error && valid && results.length > 0 && <span className="search-results-position" data-current-result={Math.min(currentResult, results.length)} data-total-results={results.length} aria-live="off">{t('search.resultPosition', { current: Math.min(currentResult, results.length), total: results.length })}</span>}
        {phase3 && <div className="phase3-result-controls">
          <SearchWorkspaceScope meta={meta} currentSurah={currentSurah} selection={{ variant: scopeVariant, surahs }}
            onScope={changeWorkspaceScope} counts={scopeCounts} countsError={!!activeScopeAnswer?.error} onCountsActive={setCountsActive} />
          <SearchWorkspaceSort config={config} onConfig={setConfig} />
        </div>}
      </div>
      <div ref={list} className="search-page-results nice-scroll" hidden={phase3 && !busy && !error && valid && !results.length} tabIndex={-1} aria-label={t("ui.57f03a82b0")} aria-busy={busy} onScroll={event => { scroll.current = event.currentTarget.scrollTop }}>
        {!phase3 && (!inline || lemmas.length > 0 || forms.length > 0) && facetControls}
        {!inline && !valid && <div className="search-empty"><BookOpen size={34} /><h2>{t("ui.2c2cdb504e")}</h2><p>{t("ui.9535464700")}</p><div>{[t("ui.cfd7c4bd1f"), t("ui.72dbd6c944"), t("ui.e7e17d45e9")].map(text => <button type="button" key={text} onClick={() => setQuery(text)}>{text}</button>)}</div></div>}
        {error && <button type="button" className="chip" onClick={() => setRetry(value => value + 1)}>{t("ui.be9b8b4f2b")}</button>}
        {!phase3 && !busy && !error && valid && !results.length && <div className="search-empty"><Search size={30} /><h2>{t("ui.b548ad6007")}</h2><p>{t("ui.d0c738e420")}</p></div>}
        {!busy && !error && valid && results.slice(0, visible).map((result, index) => <div key={`${result.s}:${result.a}`}>
          {!phase3 && !occurrenceFilter && (index === 0 || results[index - 1].kind !== result.kind) && <h2 className="search-result-group">{t(labels[result.kind])}{' · '}{t('search.totalResults', { total: groupCounts[result.kind] })}</h2>}
          <article className="search-result-card" data-search-result-index={index + 1} data-search-address={`${result.s}:${result.a}`}><button type="button" className="search-result-open" aria-current={unified?.selected?.s === result.s && unified?.selected?.a === result.a || undefined} aria-label={t("ui.a55b5ca0c4",{p0:(meta.surahs[result.s - 1]?.fa),p1:(toFa(result.a))})} onClick={() => {
            const { s, a, positions, parts } = result
            onPick(s, a, positions[0] ?? 1, linkState, capturePosition(), { s, a, positions, parts })
          }}>
            <span className="search-result-meta"><b>{meta.surahs[result.s - 1]?.fa}{' '}{t("ui.f922b82cb1")}{' '}{toFa(result.a)}</b><span className="search-result-position">{t('search.resultPosition', { current: index + 1, total: results.length })}</span>{result.cooccurrenceGroup?.unit === 'context' && <span>{t('ui.16836d5471')}{' '}{toFa(result.cooccurrenceGroup.from)}–{toFa(result.cooccurrenceGroup.to)}</span>}
            {result.cooccurrenceGroup?.unit === 'surah' && <span>{t('occurrence.thisSurah')}</span>}
            <span>{t("ui.1abf27acd0")}</span></span><span className="search-result-text font-quran" lang="ar">{snippet(result, true)}</span>
          </button>
          {showTranslation && <div className="search-result-translation" dir={translationDirection(translator)} lang={translationLanguage(translator)}>{translations[result.s]?.[String(result.a)]?.[translator] ?? (translationErrors.includes(result.s) ? <button type="button" onClick={() => setTranslationRetry(n => n + 1)}>{t("ui.76f0fc62b1")}</button> : <span role="status">{t("ui.ad34b65e87")}</span>)}</div>}
          </article>
        </div>)}
        {!busy && valid && visible < results.length && <button type="button" className="search-more" onClick={() => setVisible(count => count + 20)}>{t("ui.0c70162476")}{' '}{toFa(visible)}{' '}{t("ui.77e7a9224b")}{' '}{toFa(results.length)}</button>}
      </div>
      </>}
  </>
  const settings = phase3 && unified?.settingsHost
    ? createPortal(<SearchWorkspaceSettings config={config} onConfig={setConfig}
      partial={matchingPreferences[0]} matching={[
        { ...matchingPreferences[1], icon: SpellCheck },
        { icon: Languages, label: t('ui.2d6258b160'), checked: showTranslation, onChange: setShowTranslation },
      ]}
      actions={<section className="phase3-settings-actions">
        <button type="button" className="chip" onClick={copyLink}>
          {copyStatus === t('ui.dc5c67b8a3') ? <Check size={16} aria-hidden="true" /> : <Link size={16} aria-hidden="true" />}
          {t('ui.8f0d9edc8e')}
        </button>
        <span role="status">{copyStatus}</span>
      </section>} />, unified.settingsHost)
    : null
  if (unified && !unified.run && !unified.controls) return <>{settings}{unified.researchHost && controls}</>
  if (inline) return <>{settings}<div className={unified?.controls ? "search-and-go-settings" : "search-page-shell search-and-go-results"} data-phase3-results={phase3 || undefined}>{content}</div></>
  return createPortal(<main ref={page} className="quran-search-page" data-search-page dir={uiDirection()} aria-label={t("ui.cd32ebbeba")} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onOpenChange(false) } }}>
    <div className="search-page-shell">{content}</div>
  </main>, document.body)
}
