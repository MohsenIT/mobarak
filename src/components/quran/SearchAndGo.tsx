'use client'

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { ArrowLeft, ArrowRight, CircleHelp, MousePointer2, Pin, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { t, uiDirection } from '@/lib/i18n'
import { destinationLabel, destinationSuggestions, isExplicitDestinationQuery, isNavigationInput, NAVIGATION_HELP, resolveDestination, type Destination } from '@/lib/navigation'
import { SEARCH_AND_GO_PHASE_2, SEARCH_AND_GO_PHASE_3, readSearchLink, type SearchLinkState, type SearchResultSnapshot } from '@/lib/search-link'
import type { SearchOperationEntry } from '@/lib/search-and-go-history'
import type { Meta, Translator } from '@/lib/quran'
import DestinationOptions, { useDestinationSelection } from './DestinationOptions'
import SurahNavigationList from './SurahNavigationList'
import SurahShortcuts from './SurahShortcuts'
import { DictationInput } from './DictationInput'
import QuranSearch from './QuranSearch'
import QuranText from './QuranText'
import { searchPopupName } from './search-popup'

const searchExamples = ['س 20', 'اسما الحسنی', 'طه 40', 'صبر', 'صفحه 42', 'جزء 30', 'لا تخف', 'سیاق طه:3']

export default function SearchAndGo({ meta, currentSurah, pinned, recent, onTogglePin, onRecentSurah, onDestination, onPick, onClose, start, field, translator, onSearchStateChange, onClearOccurrenceFilter, onReplay, history, onToggleHistoryPin }: {
  field: RefObject<HTMLInputElement | null>
  meta: Meta
  currentSurah: number
  pinned: number[]
  recent: number[]
  onTogglePin: (surah: number) => void
  onRecentSurah: (surah: number) => void
  onDestination: (destination: Destination, word?: number) => void
  onPick: React.ComponentProps<typeof QuranSearch>['onPick']
  onClose: () => void
  start: SearchResultSnapshot | null
  translator: Translator
  onSearchStateChange?: (state: SearchLinkState) => void
  onClearOccurrenceFilter?: () => void
  onReplay?: (state: SearchLinkState) => void
  history?: SearchOperationEntry[]
  onToggleHistoryPin: (id: string) => void
}) {
  const [query, setQuery] = useState(start?.query ?? '')
  const [searchActive, setSearchActive] = useState(!!start)
  const [position, setPosition] = useState(start?.position)
  const [help, setHelp] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [completedQuery, setCompletedQuery] = useState<string>()
  const [selected, setSelected] = useState(start?.selected)
  const [mode, setMode] = useState(start?.state?.mode ?? 'text')
  const [occurrence, setOccurrence] = useState(start?.state?.occurrence ?? null)
  const clearOccurrence = () => {
    setOccurrence(null)
    onClearOccurrenceFilter?.()
  }
  const [surface, setSurface] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport || !surface) return
    const resize = () => {
      const element = surface
      if (viewport.scale === 1 && viewport.height < window.innerHeight - 40) {
        element.style.setProperty('--search-and-go-height', `${viewport.height}px`)
        element.style.setProperty('--search-and-go-top', `${viewport.offsetTop}px`)
      } else {
        element.style.removeProperty('--search-and-go-height')
        element.style.removeProperty('--search-and-go-top')
      }
    }
    resize()
    viewport.addEventListener('resize', resize)
    viewport.addEventListener('scroll', resize)
    return () => {
      viewport.removeEventListener('resize', resize)
      viewport.removeEventListener('scroll', resize)
    }
  }, [surface])
  const [settingsHost, setSettingsHost] = useState<HTMLDivElement | null>(null)
  const [researchHost, setResearchHost] = useState<HTMLElement | null>(null)
  const [wideWorkspace, setWideWorkspace] = useState(false)
  useEffect(() => {
    const element = surface
    if (!SEARCH_AND_GO_PHASE_3 || !element) return
    const observer = new ResizeObserver(([entry]) => setWideWorkspace(entry.contentRect.width >= 660))
    observer.observe(element)
    return () => observer.disconnect()
  }, [surface])
  useEffect(() => {
    if (!surface || !SEARCH_AND_GO_PHASE_3) return
    const dismissOutside = (event: MouseEvent) => {
      const popup = surface.querySelector<HTMLDetailsElement>(`details[name="${searchPopupName}"][open]`)
      if (popup && event.target instanceof Node && !popup.contains(event.target)) popup.open = false
    }
    document.addEventListener('click', dismissOutside, true)
    return () => document.removeEventListener('click', dismissOutside, true)
  }, [surface])
  const useResearchColumn = SEARCH_AND_GO_PHASE_3 && wideWorkspace && !help
  const back = useRef<HTMLButtonElement>(null)
  const trigger = useRef<HTMLElement>(null)
  const value = query.trim()
  const options = mode === 'text' && !occurrence ? destinationSuggestions(meta, value, start?.state?.contextSurah ?? currentSurah) : []
  const letters = /\p{L}/u.test(value)
  const text = SEARCH_AND_GO_PHASE_2
    ? !!occurrence || letters && (mode !== 'text' || !isExplicitDestinationQuery(value, options))
    : letters && !isNavigationInput(value) && !options.some(option => option.exact)
  const completions = SEARCH_AND_GO_PHASE_2 && text && !help && completedQuery !== query ? suggestions.slice(0, 3) : []
  const selection = useDestinationSelection(options, completions.length)
  const activeOptionId = selection.inputProps['aria-activedescendant']
  useEffect(() => {
    if (SEARCH_AND_GO_PHASE_3 && !help && activeOptionId) {
      document.getElementById(activeOptionId)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }, [activeOptionId, help])
  const changeQuery = (next: string) => {
    if (occurrence) clearOccurrence()
    setQuery(next)
    setSearchActive(true)
    setPosition(undefined)
    setSelected(undefined)
    setHelp(false)
    setSuggestions([])
    setCompletedQuery(undefined)
    selection.reset()
  }
  const complete = (next: string) => {
    changeQuery(next)
    setCompletedQuery(next)
    field.current?.focus({ preventScroll: true })
  }
  const empty = !value && !occurrence
  const browse = empty && (!SEARCH_AND_GO_PHASE_3 || !searchActive)
  const examples = SEARCH_AND_GO_PHASE_3 && empty && !browse && !history?.length ? [
    resolveDestination(meta, 'surah', '20', currentSurah),
    resolveDestination(meta, 'verse', '40', 20),
    resolveDestination(meta, 'page', '42', currentSurah),
    resolveDestination(meta, 'juz', '30', currentSurah),
  ] : []
  const rtl = uiDirection() === 'rtl'
  const BackIcon = rtl ? ArrowRight : ArrowLeft
  const searchLabel = t('ui.c51349274d')
  const { placeholder, shorterPlaceholders } = useMemo(() => {
    const format = (examples: string[]) => t('searchAndGo.placeholder', { label: searchLabel, examples: examples.join(rtl ? '، ' : ', ') })
    const shorter = searchExamples.slice(2).map((_, index) => format(searchExamples.slice(0, index + 2))).reverse()
    return {
      placeholder: format(searchExamples),
      shorterPlaceholders: [...shorter, format(['س 20', 'صبر']), format(['س 20']), searchLabel],
    }
  }, [rtl, searchLabel])

  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent ref={setSurface} fullscreen showCloseButton={false} className="search-and-go" data-search-and-go data-search-workspace={SEARCH_AND_GO_PHASE_3 || undefined} data-search-and-go-phase-2={SEARCH_AND_GO_PHASE_2 || undefined} data-search-page={SEARCH_AND_GO_PHASE_2 && !!start?.state || undefined} dir={uiDirection()}
      aria-describedby={undefined}
      onOpenAutoFocus={event => {
        event.preventDefault()
        if (document.activeElement instanceof HTMLElement) trigger.current = document.activeElement
        back.current?.focus({ preventScroll: true })
      }}
      onCloseAutoFocus={event => {
        event.preventDefault()
        trigger.current?.focus({ preventScroll: true })
      }}
      onEscapeKeyDown={event => {
        const options = surface?.querySelector<HTMLDetailsElement>(`details[name="${searchPopupName}"][open]`)
        if (options) {
          event.preventDefault()
          const picker = options.querySelector<HTMLButtonElement>('.phase3-scope-pick[aria-expanded="true"]')
          if (picker) { picker.click(); picker.focus(); return }
          options.open = false
          options.querySelector('summary')?.focus()
          return
        }
        if (document.activeElement === field.current) {
          event.preventDefault()
          selection.reset()
          setCompletedQuery(query)
          field.current?.blur()
        }
        else if (help) { event.preventDefault(); setHelp(false) }
      }}>
      <div className="search-and-go-shell">
        <DialogTitle className="sr-only">{searchLabel}</DialogTitle>
        <header className="search-and-go-header">
          <button type="button" ref={back} className="icon-btn" aria-label={t('ui.685e0d6bc0')}
            onClick={onClose}><BackIcon size={20} aria-hidden="true" /></button>
          <div className="search-page-input">
            <Search size={19} aria-hidden="true" onClick={() => field.current?.focus()} />
            <DictationInput {...selection.inputProps} aria-expanded={!help && selection.inputProps['aria-expanded']} aria-controls={help ? undefined : selection.inputProps['aria-controls']}
              aria-activedescendant={help ? undefined : selection.inputProps['aria-activedescendant']} ref={field} type="text" enterKeyHint={selection.destination ? 'go' : 'search'}
              value={query} maxLength={160} autoComplete="off" spellCheck={false}
              aria-label={searchLabel} placeholder={placeholder} fitPlaceholder={shorterPlaceholders}
              onFocus={() => setSearchActive(true)}
              onClear={() => changeQuery('')} onChange={event => changeQuery(event.target.value)}
              onKeyDown={event => {
                if (help || event.nativeEvent.isComposing || selection.move(event)) return
                if (event.key === 'Enter') {
                  event.preventDefault()
                  const completion = completions[selection.completion]
                  if (selection.destination) onDestination(selection.destination)
                  else if (completion) complete(completion)
                  else if (window.matchMedia('(pointer: coarse)').matches) field.current?.blur()
                }
              }} />
            {SEARCH_AND_GO_PHASE_3 && <div className="search-workspace-settings-host" ref={setSettingsHost} />}
          </div>
          <button type="button" className="icon-btn" aria-label={t('searchAndGo.help')} aria-expanded={help}
            onClick={() => { selection.reset(); setHelp(open => !open) }}>
            <CircleHelp size={20} className="search-and-go-help-icon" aria-hidden="true" />
          </button>
          {browse && !help && <div className="search-and-go-shortcuts">
            <SurahShortcuts meta={meta} pinned={pinned} recent={recent} onTogglePin={onTogglePin}
              onGo={(s, isPinned) => isPinned ? onDestination({ kind: 'surah', s }) : onRecentSurah(s)} />
          </div>}
        </header>
        {help && <div className="search-and-go-help nice-scroll">
          <dl>{NAVIGATION_HELP.map(([kind, examples]) => <div key={kind}><dt>{t(kind)}</dt><dd>{t(examples)}</dd></div>)}</dl>
          <p>{t('ui.a8175202e6')}</p>
          <p>{placeholder}</p>
          {SEARCH_AND_GO_PHASE_2 && !SEARCH_AND_GO_PHASE_3 && !!history?.some(entry => entry.operation.type === 'text') && onReplay && <div className="drawer-recent-shortcuts">
            {history.map(entry => {
              if (entry.operation.type !== 'text') return null
              const state = readSearchLink(entry.operation.link)
              return state && <button type="button" className="chip" key={entry.id} onClick={() => onReplay(state)}>{state.query || state.occurrence?.text}</button>
            })}
          </div>}
        </div>}
        <div className="search-and-go-body" data-show-controls={SEARCH_AND_GO_PHASE_2 && help || undefined} data-text-results={SEARCH_AND_GO_PHASE_2 && text || undefined} data-research-column={useResearchColumn || undefined} hidden={help && !SEARCH_AND_GO_PHASE_2}>
          <div className="search-workspace-main">
          {!help && !empty && (options.length > 0 || completions.length > 0) &&
            <div className={SEARCH_AND_GO_PHASE_3 ? "search-and-go-suggestions nice-scroll" : "contents"}>
              {SEARCH_AND_GO_PHASE_3 && options.length > 0 && <MousePointer2 size={15} aria-hidden="true" className="search-and-go-pointer" />}
              <DestinationOptions id={selection.id} active={selection.active} options={options} onPick={onDestination} className="drawer-destination-options" asChips={SEARCH_AND_GO_PHASE_3} />
              {SEARCH_AND_GO_PHASE_3 && options.length > 0 && completions.length > 0 && <span className="search-and-go-divider" aria-hidden="true" />}
              {completions.length > 0 && <div className="search-and-go-completions nice-scroll" id={selection.completionId}
                data-search-completions role="listbox" aria-label={t('ui.7bf42d2a96')}>
                {completions.map((completion, index) => <button type="button" className="chip" key={completion} id={`${selection.completionId}-${index}`}
                  role="option" aria-selected={selection.completion === index} onMouseDown={event => event.preventDefault()} onClick={() => complete(completion)}>
                  <Search size={14} aria-hidden="true" /><QuranText text={completion} />
                </button>)}
              </div>}
            </div>}
          {!help && !empty && <>
            {!text && !options.length && <p role="status" className="search-and-go-no-destination">{t('ui.68f830ec5c')}</p>}
          </>}
          {!help && browse && <SurahNavigationList meta={meta} currentSurah={currentSurah} query="" showEmpty={false}
            onGoSurah={s => onDestination({ kind: 'surah', s })} />}
          {!help && empty && !browse && <section className="search-and-go-empty nice-scroll">
            {!!history?.length ? <>
              <h2>{t('searchP3.history')}</h2>
              <ul className="search-and-go-history nice-scroll">{[...history].sort((a, b) => Number(b.pinned) - Number(a.pinned)).map(entry => {
                const op = entry.operation
                const state = op.type === 'text' ? readSearchLink(op.link) : null
                const label = op.type === 'navigation' ? destinationLabel(meta, op.destination) : state?.query || state?.occurrence?.text
                const Icon = op.type === 'navigation' ? MousePointer2 : Search
                return <li key={entry.id}>
                  <button type="button" className="chip" onClick={() => {
                    if (op.type === 'navigation') onDestination(op.destination, op.word)
                    else if (state) onReplay?.(state)
                  }}><Icon size={14} aria-hidden="true" /><span>{label}</span></button>
                  <button type="button" className="icon-btn" aria-pressed={entry.pinned} aria-label={t('searchP3.pinHistory', { label })}
                    onClick={() => onToggleHistoryPin(entry.id)}><Pin size={14} aria-hidden="true" /></button>
                </li>
              })}</ul>
            </> : <>
              <h2>{t('searchP3.emptyTitle')}</h2>
              <p>{t('searchP3.emptyDescription')}</p>
              <div className="search-and-go-examples">
                <button type="button" className="chip" onClick={() => complete(t('searchP3.exampleText'))}><Search size={14} aria-hidden="true" />{t('searchP3.exampleText')}</button>
                {examples.map((destination, index) => destination && <button type="button" className="chip" key={index}
                  onClick={() => onDestination(destination)}><MousePointer2 size={14} aria-hidden="true" />
                  {index === 3 ? t('searchP3.exampleJuz', { number: 30 }) : destinationLabel(meta, destination)}</button>)}
              </div>
            </>}
            <button type="button" className="search-and-go-browse" onClick={() => { field.current?.blur(); setSearchActive(false) }}>{t('searchP3.browse')}</button>
          </section>}
          <QuranSearch inline={{
            query: SEARCH_AND_GO_PHASE_2 ? query : value,
            position,
            unified: SEARCH_AND_GO_PHASE_2 ? { run: text, controls: help, input: field, settingsHost, researchHost, selected, onSuggestions: setSuggestions, onModeChange: mode => { setMode(mode); selection.reset(); setSuggestions([]) } } : undefined,
          }} open={SEARCH_AND_GO_PHASE_2 || text} onOpenChange={onClose}
            initialSearch={start?.state ? { query: start.query, mode: start.state.mode, surahs: start.state.surahs, revision: 0, state: start.state } : null}
            occurrenceFilter={occurrence} onClearOccurrenceFilter={clearOccurrence} onStateChange={onSearchStateChange}
            meta={meta} translator={translator} currentSurah={currentSurah} onPick={onPick} />
          </div>
          {useResearchColumn && <aside className="search-workspace-research" ref={setResearchHost} aria-label={t('searchP3.research')} />}
        </div>
      </div>
    </DialogContent>
  </Dialog>
}
