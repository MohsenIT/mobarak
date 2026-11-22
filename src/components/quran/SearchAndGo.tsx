'use client'

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { ArrowLeft, ArrowRight, CircleHelp, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { t, uiDirection } from '@/lib/i18n'
import { destinationSuggestions, isExplicitDestinationQuery, isNavigationInput, NAVIGATION_HELP, type Destination } from '@/lib/navigation'
import { SEARCH_AND_GO_PHASE_2, readSearchLink, type SearchLinkState, type SearchResultSnapshot } from '@/lib/search-link'
import type { SearchOperationEntry } from '@/lib/search-and-go-history'
import type { Meta, Translator } from '@/lib/quran'
import DestinationOptions, { useDestinationSelection } from './DestinationOptions'
import SurahNavigationList from './SurahNavigationList'
import SurahShortcuts from './SurahShortcuts'
import { DictationInput } from './DictationInput'
import QuranSearch from './QuranSearch'
import QuranText from './QuranText'

const searchExamples = ['س 20', 'اسما الحسنی', 'طه 40', 'صبر', 'صفحه 42', 'جزء 30', 'لا تخف', 'سیاق طه:3']

export default function SearchAndGo({ meta, currentSurah, pinned, recent, onTogglePin, onRecentSurah, onDestination, onPick, onClose, start, field, translator, onSearchStateChange, onClearOccurrenceFilter, onReplay, textHistory }: {
  field: RefObject<HTMLInputElement | null>
  meta: Meta
  currentSurah: number
  pinned: number[]
  recent: number[]
  onTogglePin: (surah: number) => void
  onRecentSurah: (surah: number) => void
  onDestination: (destination: Destination) => void
  onPick: React.ComponentProps<typeof QuranSearch>['onPick']
  onClose: () => void
  start: SearchResultSnapshot | null
  translator: Translator
  onSearchStateChange?: (state: SearchLinkState) => void
  onClearOccurrenceFilter?: () => void
  onReplay?: (state: SearchLinkState) => void
  textHistory?: SearchOperationEntry[]
}) {
  const [query, setQuery] = useState(start?.query ?? '')
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
  const surface = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const resize = () => {
      const element = surface.current
      if (!element) return
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
  }, [])
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
  const changeQuery = (next: string) => {
    if (occurrence) clearOccurrence()
    setQuery(next)
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
  const browse = !value && !occurrence
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
    <DialogContent ref={surface} fullscreen showCloseButton={false} className="search-and-go" data-search-and-go data-search-and-go-phase-2={SEARCH_AND_GO_PHASE_2 || undefined} data-search-page={SEARCH_AND_GO_PHASE_2 && !!start?.state || undefined} dir={uiDirection()}
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
          {SEARCH_AND_GO_PHASE_2 && !!textHistory?.length && onReplay && <div className="drawer-recent-shortcuts">
            {textHistory.map(entry => {
              if (entry.operation.type !== 'text') return null
              const state = readSearchLink(entry.operation.link)
              return state && <button type="button" className="chip" key={entry.id} onClick={() => onReplay(state)}>{state.query || state.occurrence?.text}</button>
            })}
          </div>}
        </div>}
        <div className="search-and-go-body" data-show-controls={SEARCH_AND_GO_PHASE_2 && help || undefined} data-text-results={SEARCH_AND_GO_PHASE_2 && text || undefined} hidden={help && !SEARCH_AND_GO_PHASE_2}>
          {!help && !browse && <>
            <DestinationOptions id={selection.id} active={selection.active} options={options} onPick={onDestination} className="drawer-destination-options" />
            {!text && !options.length && <p role="status" className="search-and-go-no-destination">{t('ui.68f830ec5c')}</p>}
          </>}
          {!help && browse && <SurahNavigationList meta={meta} currentSurah={currentSurah} query="" showEmpty={false}
            onGoSurah={s => onDestination({ kind: 'surah', s })} />}
          {completions.length > 0 && <div className="search-and-go-completions nice-scroll" id={selection.completionId}
            data-search-completions role="listbox" aria-label={t('ui.7bf42d2a96')}>
            {completions.map((completion, index) => <button type="button" className="chip" key={completion} id={`${selection.completionId}-${index}`}
              role="option" aria-selected={selection.completion === index} onMouseDown={event => event.preventDefault()} onClick={() => complete(completion)}>
              <Search size={14} aria-hidden="true" /><QuranText text={completion} />
            </button>)}
          </div>}
          <QuranSearch inline={{
            query: SEARCH_AND_GO_PHASE_2 ? query : value,
            position,
            unified: SEARCH_AND_GO_PHASE_2 ? { run: text, controls: help, input: field, selected, onSuggestions: setSuggestions, onModeChange: mode => { setMode(mode); selection.reset(); setSuggestions([]) } } : undefined,
          }} open={SEARCH_AND_GO_PHASE_2 || text} onOpenChange={onClose}
            initialSearch={start?.state ? { query: start.query, mode: start.state.mode, surahs: start.state.surahs, revision: 0, state: start.state } : null}
            occurrenceFilter={occurrence} onClearOccurrenceFilter={clearOccurrence} onStateChange={onSearchStateChange}
            meta={meta} translator={translator} currentSurah={currentSurah} onPick={onPick} />
        </div>
      </div>
    </DialogContent>
  </Dialog>
}
