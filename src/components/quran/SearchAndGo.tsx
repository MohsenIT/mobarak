'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CircleHelp, Search, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { t, uiDirection } from '@/lib/i18n'
import { destinationSuggestions, isNavigationInput, NAVIGATION_HELP, type Destination } from '@/lib/navigation'
import type { SearchOperation, SearchOperationEntry } from '@/lib/search-and-go-history'
import type { Meta } from '@/lib/quran'
import DestinationOptions, { useDestinationSelection } from './DestinationOptions'
import SurahNavigationList from './SurahNavigationList'
import SurahShortcuts from './SurahShortcuts'
import SearchAndGoHistory from './SearchAndGoHistory'

const examples = [
  ['طه', 'ui.a37a87553b'],
  ['طه ۴۰', 'ui.b1b168c791'],
  ['صفحه ۶۰۴', 'ui.0572e8936c'],
  ['جزء ۳۰', 'ui.f74f9b04c7'],
  ['سیاق طه:۳', 'ui.16836d5471'],
  ['لا تخف', 'ui.0f4147fe60'],
] as const


export default function SearchAndGo({ meta, currentSurah, pinned, recent, onTogglePin, onRecentSurah, onDestination, onText, onClose, operations, onReplay, onPinOperation }: {
  meta: Meta
  currentSurah: number
  pinned: number[]
  recent: number[]
  onTogglePin: (surah: number) => void
  onRecentSurah: (surah: number) => void
  onDestination: (destination: Destination) => void
  onText: (query: string) => void
  onClose: () => void
  operations: SearchOperationEntry[]
  onReplay: (operation: SearchOperation) => void
  onPinOperation: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [help, setHelp] = useState(false)
  const [focused, setFocused] = useState(false)
  const surface = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const viewport = window.visualViewport
    const element = surface.current
    if (!viewport || !element) return
    const resize = () => {
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
  const field = useRef<HTMLInputElement>(null)
  const value = query.trim()
  const options = destinationSuggestions(meta, value, currentSurah)
  const selection = useDestinationSelection(options)
  const text = !!value && !isNavigationInput(value) && !options.some(option => option.exact) && /\p{L}/u.test(value)
  const changeQuery = (next: string) => { setQuery(next); selection.reset() }

  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent ref={surface} fullscreen showCloseButton={false} className="search-and-go" data-search-and-go dir={uiDirection()}
      aria-describedby={undefined} onOpenAutoFocus={event => { event.preventDefault(); back.current?.focus({ preventScroll: true }) }}
      onEscapeKeyDown={event => {
        if (document.activeElement === field.current) { event.preventDefault(); field.current?.blur() }
        else if (help) { event.preventDefault(); setHelp(false) }
      }}>
      <div className="search-and-go-shell">
        <header className="search-and-go-header">
          <div className="search-and-go-title">
            <button type="button" ref={back} className="icon-btn" aria-label={help ? t('ui.313cbecb4d') : t('ui.685e0d6bc0')}
              onClick={() => help ? setHelp(false) : onClose()}><ArrowRight size={20} aria-hidden="true" /></button>
            <DialogTitle>{t(help ? 'ui.f4bf9b146f' : 'ui.54778fcf78')}</DialogTitle>
            {!help && <button type="button" className="icon-btn" aria-label={t('ui.f4bf9b146f')} onClick={() => setHelp(true)}><CircleHelp size={20} aria-hidden="true" /></button>}
          </div>
          {!help && <div className="search-page-input">
            <Search size={19} aria-hidden="true" />
            <input {...selection.inputProps} ref={field} type="search" enterKeyHint="go" value={query} maxLength={160}
              autoComplete="off" spellCheck={false} aria-label={t('ui.54778fcf78')} placeholder={t('ui.5bb212ac5e')}
              onFocus={() => setFocused(true)} onChange={event => changeQuery(event.target.value)} onKeyDown={event => {
                if (event.nativeEvent.isComposing || selection.move(event)) return
                if (event.key === 'Enter') {
                  event.preventDefault()
                  if (selection.destination) onDestination(selection.destination)
                  else field.current?.blur()
                }
              }} />
            {query && <button type="button" aria-label={t('ui.f37fae1000')} onClick={() => { changeQuery(''); field.current?.focus() }}><X size={17} aria-hidden="true" /></button>}
          </div>}
        </header>
        {help && <div className="search-and-go-help nice-scroll">
          <dl>{NAVIGATION_HELP.map(([kind, examples]) => <div key={kind}><dt>{t(kind)}</dt><dd>{t(examples)}</dd></div>)}</dl>
          <p>{t('ui.a8175202e6')}</p>
        </div>}
        <div className="search-and-go-body" hidden={help}>
          {!value && <SurahShortcuts meta={meta} pinned={pinned} recent={recent} onTogglePin={onTogglePin} onGo={(s, isPinned) => isPinned ? onDestination({ kind: 'surah', s }) : onRecentSurah(s)} />}
          {!value && focused && (operations.length
            ? <SearchAndGoHistory meta={meta} operations={operations} onReplay={onReplay} onPin={onPinOperation} />
            : <div className="search-and-go-examples" role="group" aria-label={t('ui.f4bf9b146f')}>
              {examples.map(([example, label]) => <button type="button" className="chip" key={example}
                onClick={() => { changeQuery(example); field.current?.focus() }}><small>{t(label)}</small><bdi>{example}</bdi></button>)}
            </div>)}
          <DestinationOptions id={selection.id} active={selection.active} options={options} onPick={onDestination} className="drawer-destination-options" />
          {text && <div className="search-and-go-text"><button type="button" className="chip" onClick={() => onText(value)}><Search size={16} aria-hidden="true" />{t('ui.c51349274d')}</button></div>}
          <SurahNavigationList meta={meta} currentSurah={currentSurah} query={value} showEmpty={!options.length && !text} onGoSurah={s => onDestination({ kind: 'surah', s })} />
        </div>
      </div>
    </DialogContent>
  </Dialog>
}
