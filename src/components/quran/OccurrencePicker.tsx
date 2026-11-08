'use client'
import {t} from '@/lib/i18n'
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { Arrow as PopoverArrow } from '@radix-ui/react-popover'
import { Search, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { SurahData } from '@/lib/quran'
import { toFa } from '@/lib/quran'
import type { AnalysisLocation } from '@/lib/analysis'
import { groupOccurrencesByAyah, occurrenceTokens, occurrenceWindow, type ContextToken } from '@/lib/occurrence-context'
import { AyahMarker } from './Ornaments'
import QuranText from './QuranText'
import QuranHighlight from './QuranHighlight'
import type {OccurrenceScope} from '@/lib/occurrence-scope'
import SearchScopeIcon from './SearchScopeIcon'

export type PickerOperation = 'exact' | 'similarity'

export default function OccurrencePicker({ open, onOpenChange, items, index, surah, groupKey, label, title, onSelect, onFull, operation = 'exact', scopes = ['surah','quran'] }: {
  open: boolean; onOpenChange: (open: boolean) => void; items: AnalysisLocation[]; index: number
  surah: SurahData | null; groupKey: string; label: string; title: ReactNode
  onSelect: (location: AnalysisLocation) => void; onFull?: (scope: OccurrenceScope) => void
  /** Shared contract: tabs only supply the operation and supported scopes. */
  operation?: PickerOperation; scopes?: readonly Extract<OccurrenceScope, 'surah' | 'quran'>[]
}) {
  const list = useRef<HTMLDivElement>(null)
  // The scroll offset to restore when this picker reopens. It belongs to the
  // group it was scrolled in: a different group starts at the top, so the
  // offset is dropped when the group changes. That reset lives in an effect
  // rather than in render because a ref must not be mutated while rendering.
  const offset = useRef<number | null>(null)
  useEffect(() => { offset.current = null }, [groupKey])
  const tokens = useMemo(() => surah ? occurrenceTokens(surah) : [], [surah])
  const groups = useMemo(() => groupOccurrencesByAyah(items), [items])
  return <Popover open={open} onOpenChange={onOpenChange}>
    <PopoverTrigger asChild><button className="analysis-position-button" disabled={index < 0 || !items.length} aria-label={label}>{title}</button></PopoverTrigger>
    <PopoverContent className="analysis-position-picker" dir="rtl" data-analysis-picker side="top" sideOffset={9}
      aria-label={t("ui.b55272cf13")} onOpenAutoFocus={event => {
        event.preventDefault()
        requestAnimationFrame(() => {
          const selected = list.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')
          selected?.focus({ preventScroll: true })
          if (list.current && offset.current !== null) list.current.scrollTop = offset.current
          else selected?.scrollIntoView({ block: 'nearest' })
        })
      }}>
      <div className="occurrence-picker-heading">
        {onFull && <div className="occurrence-search-scopes" data-picker-operation={operation}>
          <span className="occurrence-search-label"><Search size={15} aria-hidden="true" />{t('occurrence.searchIn')}</span>
          <div className="occurrence-search-chips" role="group" aria-label={t('occurrence.searchIn')}>
            {([['surah','occurrence.thisSurah'],['quran','occurrence.wholeQuran']] as const).filter(([scope]) => scopes.includes(scope)).map(([scope,key]) => <button key={scope} type="button" className="occurrence-search-shortcut" data-occurrence-scope={scope}
              disabled={!surah} onClick={() => { onOpenChange(false); onFull(scope) }}><SearchScopeIcon scope={scope} /><span>{t(key)}</span></button>)}
          </div>
        </div>}
        <button type="button" className="occurrence-picker-close" aria-label={t("ui.510fc4baec")} onClick={() => onOpenChange(false)}><X size={18} /></button>
      </div>
      <div ref={list} className="occurrence-picker-list nice-scroll" onScroll={event => { offset.current = event.currentTarget.scrollTop }}>
        {groups.map(group => {
          const selected = group.indexes.includes(index)
          const location = selected ? items[index] : group.locations[0]
          return <OccurrenceRow key={group.a} tokens={tokens} a={group.a} pos={location[1]} part={location[2]} locations={group.locations} selected={selected}
            onPick={() => { offset.current = list.current?.scrollTop ?? 0; onSelect(location); onOpenChange(false) }} />
        })}
      </div>
      <PopoverArrow width={18} height={9} className="occurrence-picker-arrow" />
    </PopoverContent>
  </Popover>
}
function OccurrenceRow({ tokens, a, pos, part, locations, selected, onPick }: {
  tokens: ContextToken[]; a: number; pos: number; part?: 'prefix' | 'stem'; locations: AnalysisLocation[]; selected: boolean; onPick: () => void
}) {
  const viewport = useRef<HTMLSpanElement>(null)
  const target = useRef<HTMLSpanElement>(null)
  const drag = useRef<{ x: number; y: number; left: number; locked: boolean } | null>(null)
  const suppressClick = useRef(0)
  const excerpt = useMemo(() => occurrenceWindow(tokens, a, pos, part), [tokens, a, pos, part])
  useLayoutEffect(() => {
    const element = viewport.current
    if (!element) return
    const align = () => {
      if (!target.current) return
      const box = element.getBoundingClientRect()
      element.scrollLeft += target.current.getBoundingClientRect().right - (box.right - box.width * .32)
    }
    align()
    void document.fonts.ready.then(align)
    const observer = new ResizeObserver(align); observer.observe(element)
    return () => observer.disconnect()
  }, [excerpt])
  return <button type="button" className="analysis-position-option has-excerpt" aria-current={selected ? 'true' : undefined} onClick={event => {
    if (Date.now() < suppressClick.current) { event.preventDefault(); return }
    onPick()
  }}>
    <span className="analysis-occurrence-reference">{t("ui.b1b168c791")}{' '}{toFa(a)}{locations.length > 1 && t("ui.afc417e2c0",{p0:(toFa(locations.length))})}</span>
    <span ref={viewport} className="occurrence-pan font-quran" dir="rtl" title={t("ui.8df9ff79ae")}
      onPointerDown={event => { if (event.isPrimary && event.button === 0) drag.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, locked: false } }}
      onPointerMove={event => {
        const start = drag.current
        if (!start) return
        const dx = event.clientX - start.x, dy = event.clientY - start.y
        if (!start.locked) {
          if (Math.abs(dy) > 7 && Math.abs(dy) > Math.abs(dx)) { drag.current = null; return }
          if (Math.abs(dx) < 7 || Math.abs(dx) < Math.abs(dy) * 1.3) return
          start.locked = true; event.currentTarget.setPointerCapture(event.pointerId)
        }
        event.preventDefault(); suppressClick.current = Date.now() + 400
        event.currentTarget.scrollLeft = start.left - dx
      }}
      onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={event => { if (event.target === event.currentTarget) drag.current = null }}
      onContextMenu={event => event.preventDefault()}>
      <span className="occurrence-pan-text">{excerpt.tokens.map((token, i) => <span key={i}>{i > 0 && ' '}{token.kind === 'marker' ? <AyahMarker n={token.a} /> : <span ref={i === excerpt.target ? target : undefined}>{locations.some(([ayah, position, wordPart]) => token.a === ayah && token.pos === position && token.part === (wordPart ?? 'stem')) ? <QuranHighlight text={token.text} state={selected && token.pos === pos && token.part === (part ?? 'stem') ? 'selected' : 'match'} /> : <QuranText text={token.text} />}</span>}</span>)}</span>
    </span>
  </button>
}
