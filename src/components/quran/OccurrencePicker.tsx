'use client'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Arrow as PopoverArrow } from '@radix-ui/react-popover'
import { List, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { SurahData } from '@/lib/quran'
import { toFa } from '@/lib/quran'
import type { AnalysisLocation } from '@/lib/analysis'
import { occurrenceTokens, occurrenceWindow, type ContextToken } from '@/lib/occurrence-context'
import { AyahMarker } from './Ornaments'
import QuranText from './QuranText'

export default function OccurrencePicker({ open, onOpenChange, items, index, surah, groupKey, label, title, onSelect, onFull }: {
  open: boolean; onOpenChange: (open: boolean) => void; items: AnalysisLocation[]; index: number
  surah: SurahData | null; groupKey: string; label: string; title: string
  onSelect: (location: AnalysisLocation) => void; onFull?: () => void
}) {
  const list = useRef<HTMLDivElement>(null)
  const memory = useRef<{ group: string; top: number | null }>({ group: groupKey, top: null })
  if (memory.current.group !== groupKey) memory.current = { group: groupKey, top: null }
  const tokens = useMemo(() => surah ? occurrenceTokens(surah) : [], [surah])
  return <Popover open={open} onOpenChange={onOpenChange}>
    <PopoverTrigger asChild><button className="analysis-position-button" disabled={index < 0 || !items.length} aria-label={label}>{title}</button></PopoverTrigger>
    <PopoverContent className="analysis-position-picker" dir="rtl" data-analysis-picker side="top" sideOffset={9}
      aria-label="فهرست تکرارها" onOpenAutoFocus={event => {
        event.preventDefault()
        requestAnimationFrame(() => {
          const selected = list.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')
          selected?.focus({ preventScroll: true })
          if (list.current && memory.current.top !== null) list.current.scrollTop = memory.current.top
          else selected?.scrollIntoView({ block: 'nearest' })
        })
      }}>
      <div className="occurrence-picker-heading"><p>تکرارها در این سوره</p><div>
        {onFull && <button type="button" aria-label="نمایش کامل تکرارها در جست‌وجو" title="نمایش کامل" onClick={() => { onOpenChange(false); onFull() }}><List size={17} /><span>نمایش کامل</span></button>}
        <button type="button" aria-label="بستن فهرست تکرارها" onClick={() => onOpenChange(false)}><X size={18} /></button>
      </div></div>
      <div ref={list} className="occurrence-picker-list nice-scroll" onScroll={event => { memory.current.top = event.currentTarget.scrollTop }}>
        {items.map(([a, pos, part], i) => <OccurrenceRow key={`${a}:${pos}:${part ?? 'stem'}`} tokens={tokens} a={a} pos={pos} part={part} number={i + 1} selected={index === i}
          onPick={() => { memory.current.top = list.current?.scrollTop ?? 0; onSelect([a, pos, part]); onOpenChange(false) }} />)}
      </div>
      <PopoverArrow width={18} height={9} className="occurrence-picker-arrow" />
    </PopoverContent>
  </Popover>
}
function OccurrenceRow({ tokens, a, pos, part, number, selected, onPick }: {
  tokens: ContextToken[]; a: number; pos: number; part?: 'prefix' | 'stem'; number: number; selected: boolean; onPick: () => void
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
    <span className="analysis-occurrence-reference">{toFa(number)} · آیه {toFa(a)}</span>
    <span ref={viewport} className="occurrence-pan font-quran" dir="rtl" title="برای خواندن ادامه، به دو طرف بکشید"
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
      <span className="occurrence-pan-text">{excerpt.tokens.map((token, i) => <span key={i}>{i > 0 && ' '}{token.kind === 'marker' ? <AyahMarker n={token.a} /> : <span ref={i === excerpt.target ? target : undefined} className={i === excerpt.target ? 'analysis-occurrence-match' : undefined}><QuranText text={token.text} /></span>}</span>)}</span>
    </span>
  </button>
}
