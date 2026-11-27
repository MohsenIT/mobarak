'use client'
import {DictationInput} from './DictationInput'
import {t} from '@/lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Search } from 'lucide-react'
import { parseProfessionalQuery } from '@/lib/professional-query'
import { destinationSuggestions, isExplicitDestinationQuery, isNavigationInput, normalizeSearch, type Destination } from '@/lib/navigation'
import DestinationOptions, { useDestinationSelection } from './DestinationOptions'
import type { SurahMeta, Meta } from '@/lib/quran'
import { loadSurah, toFa } from '@/lib/quran'
import { createSearchSession, type SearchCorpus, type SearchSessionOptions } from '@/lib/quran-search-session'
import { createQuranSearchWorker } from '@/lib/quran-search-client'
import { defaultPhase3SearchOptions } from '@/lib/search-query'
import type { QuranSearchResult } from '@/lib/quran-search'
import type { SearchMode } from '@/lib/quran-search-session'
import type { SearchStart } from './QuranSearch'
import OccurrenceStepper from './OccurrenceStepper'
import QuickSearchResultPicker from './QuickSearchResultPicker'
import { AdvancedSearchIcon } from './ReaderSearchIcon'

export default function QuickSurahSearch({ surah: currentSurah, scope, onScopeChange, meta, onNavigate, onClose, onPick, onAdvanced, onHighlights, resultsBar }: {
  resultsBar: HTMLDivElement | null
  scope: 'surah' | 'quran'; onScopeChange: (scope: 'surah' | 'quran') => void
  meta: Meta; onNavigate: (destination: Destination) => void; surah: SurahMeta; onClose: () => void; onPick: (s: number, a: number, pos: number) => void
  onAdvanced: (start: Omit<SearchStart, 'revision'>) => void
  onHighlights:(value:{results:QuranSearchResult[];index:number})=>void
}) {
  // The source surah belongs to this search, not to whichever hit is revealed.
  const [surah, setSurah] = useState(currentSurah)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('text')
  const syntax = parseProfessionalQuery(query).status
  const destinations = mode === 'text' && syntax === 'ordinary' ? destinationSuggestions(meta, query, surah.n, { compact: true }) : []
  const namedSurah = !isNavigationInput(query) &&
    destinations.some(item => item.exact && item.destination.kind === 'surah')
  const navigationOnly = mode === 'text' && syntax === 'ordinary' && !namedSurah &&
    (isExplicitDestinationQuery(query, destinations) || /^\d+$/.test(normalizeSearch(query)))
  const selection = useDestinationSelection(destinations)
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
    const instance = createQuranSearchWorker()
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
    const value = query.trim()
    if (syntax === 'invalid' || navigationOnly) { setBusy(false); return }
    if (syntax === 'ordinary' && value.length < 2) { setBusy(false); return }
    setBusy(true)
    if (scope === 'surah' && !localEngine) return
    const timer = setTimeout(() => {
      const receive = (items: QuranSearchResult[]) => {
        if (id !== request.current) return
        items.sort((a, b) => a.s - b.s || a.a - b.a || a.positions[0] - b.positions[0])
        setResults(items); setBusy(false)
        if (!namedSurah) jump(items, 0)
      }
      try {
        if (id !== request.current) return
        const options: SearchSessionOptions = {
          mode, includePartial: true, surahs: scope === 'surah' ? [surah.n] : [],
          // Quick search uses the shared query rules even when the advanced UI is off.
          phase3: defaultPhase3SearchOptions(),
        }
        if (scope === 'quran' && worker.current) {
          worker.current.onmessage = (event: MessageEvent<{id:number;results?:QuranSearchResult[];error?:boolean}>) => {
            if (event.data.id !== request.current) return
            if (event.data.error) { setError(true); setBusy(false) }
            else receive(event.data.results ?? [])
          }
          worker.current.onerror = () => { if (id === request.current) { setError(true); setBusy(false) } }
          worker.current.postMessage({ id, query: value, options })
        } else if (localEngine) receive(localEngine(value, options))
      } catch { setError(true); setBusy(false) }
    }, 60)
    return () => { clearTimeout(timer); request.current++ }
  }, [query, mode, surah.n, localEngine, scope, syntax, namedSurah, navigationOnly])
  const expand = (all: boolean) => onAdvanced({ query, mode, surahs: all ? [] : [surah.n] })
  const activeResult = syntax !== 'invalid' && !busy && !error && results[index]
  const neighborAddress = (result: QuranSearchResult | undefined) => result
    ? `${meta.surahs[result.s - 1].fa} ${toFa(result.a)}` : undefined
  return <div className="quick-surah-search reader-search-width" aria-label={t("ui.a1edc5936b")}>
    <form onSubmit={event => {
      event.preventDefault()
      const destination = selection.destination ?? destinations[0]?.destination
      if (destination) onNavigate(destination)
      else if (!busy) jump(results, index + 1)
    }}>
      <button type="button" className="icon-btn" aria-label={t("ui.8b070f0497")} onClick={onClose}><ArrowRight size={20} /></button>
      <DictationInput speechLocale="ar" ref={input} type="search" value={query} maxLength={160} leadingIcon={<Search size={18} aria-hidden="true" />}
        aria-controls={selection.inputProps['aria-controls']} aria-activedescendant={selection.inputProps['aria-activedescendant']}
        enterKeyHint={destinations.length ? 'go' : 'search'}
        onClear={() => { selection.reset(); setQuery('') }}
        onChange={event => { selection.reset(); setQuery(event.target.value) }} aria-label={t('ui.26fa3c1923')}
        placeholder={t('ui.a2897ec32a')} fitPlaceholder autoComplete="off" spellCheck={false} onKeyDown={event => { if (event.key === 'Escape') onClose(); else if (!event.nativeEvent.isComposing) selection.move(event) }} />
      <button type="button" className="quick-search-advanced" onClick={() => expand(scope === 'quran')}>
        <AdvancedSearchIcon size={18} />{t('ui.9617b95709')}
      </button>
    </form>
    {destinations.length > 0 && <div className="quick-jump-options">
      <span>{t('quickSearch.goTo')}</span>
      <DestinationOptions id={selection.id} active={selection.active} options={destinations} onPick={onNavigate} className="quick-destination-chips" asChips />
    </div>}
    <div className="quick-search-actions">
      <div className="quick-search-mode quick-search-segment" role="group" aria-label={t("ui.5e4040c150")}>{([['text', t("ui.0f4147fe60")], ['root', t("ui.eecfc08eb8")], ['lemma', t("ui.8d5e58ddd8")]] as const).map(([key, title]) => <button type="button" key={key} aria-pressed={key === mode} onClick={() => { selection.reset(); setMode(key) }}><span>{title}</span></button>)}</div>
      <div className="quick-search-scope quick-search-segment" role="group" aria-label={t('occurrence.searchIn')}>
        {(['surah','quran'] as const).map(value => <button type="button" key={value} aria-pressed={scope === value} onClick={() => { if (value === 'surah' && scope !== value) setSurah(currentSurah); onScopeChange(value) }}><span>{t(value === 'surah' ? 'occurrence.thisSurah' : 'occurrence.wholeQuran')}</span></button>)}
      </div>
    </div>
    {resultsBar && (activeResult || (query.trim() && (!navigationOnly || !destinations.length))) && createPortal(
      <div className="quick-search-status">
        {activeResult ? <OccurrenceStepper countLabel={t('ui.61cf4e03c8')}
          previous={{
            label: t(scope === 'quran' ? 'quickSearch.previousResult' : 'ui.1cfdb521b9'),
            count: index, disabled: index <= 0, description: neighborAddress(results[index - 1]),
            onClick: () => jump(results, index - 1),
          }}
          next={{
            label: t(scope === 'quran' ? 'quickSearch.nextResult' : 'ui.3c9bb58eee'),
            count: results.length - index - 1, disabled: index >= results.length - 1,
            description: neighborAddress(results[index + 1]), onClick: () => jump(results, index + 1),
          }}
          center={<QuickSearchResultPicker key={`${scope}:${mode}:${query}`} meta={meta} results={results} index={index}
            onSelect={i => jump(results, i)} onFull={targetScope => onAdvanced({ query, mode, surahs: targetScope === 'quran' ? [] : [activeResult.s] })} />}
        /> : <span role="status">{syntax === 'invalid' ? t('searchProfessional.invalid') : navigationOnly ? t('ui.68f830ec5c') : busy ? t('ui.63509f3da4') : error ? t('ui.e5d91b8562') : (syntax === 'valid' || query.trim().length >= 2) ? t('ui.292cf63931') : t('ui.d1400e3d47')}</span>}
      </div>,
      resultsBar,
    )}
  </div>
}
