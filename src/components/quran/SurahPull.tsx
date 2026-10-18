'use client'

import { memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { loadSurah, loadTrans, type SurahData, type SurahMeta, type Translations, type Translator } from '@/lib/quran'
import FlowPage, { FlowSurface } from './FlowPage'

const THRESHOLD = 210
const ignoreWordTap = () => {}
// Keep full adjacent pages mounted without rerendering their words on every touch move.
const AdjacentFlowPage = memo(FlowPage)

/** Edge-only, deliberate pull: releasing before the threshold always cancels. */
export default function SurahPull({ surah, meta, ready, enabled, arriveAtEnd, onNavigate, children, fontSize, showTrans, translator }: {
  fontSize: number; showTrans: boolean; translator: Translator
  surah: number; meta: SurahMeta[]; ready: boolean; enabled: boolean; arriveAtEnd: boolean
  onNavigate: (surah: number, atEnd: boolean) => Promise<void>; children: ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [pull, setPull] = useState(0)
  const [previous, setPrevious] = useState(true)
  const [settling, setSettling] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [neighbors, setNeighbors] = useState<Record<number, SurahData>>({})
  const [translations, setTranslations] = useState<Record<number, Translations>>({})
  const landed = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const navigate = useRef(onNavigate)
  navigate.current = onNavigate
  useLayoutEffect(() => {
    if (!ready || landed.current || !scrollRef.current) return
    const element = scrollRef.current
    const land = () => { element.scrollTop = arriveAtEnd ? element.scrollHeight : 0 }
    land()
    if (!arriveAtEnd) { landed.current = true; return }
    // Translations and fonts can finish after the Arabic text. Stay at the end
    // until the reader interacts, then let them scroll freely.
    let live = true
    const observer = new ResizeObserver(() => { if (live) land() })
    if (element.firstElementChild) observer.observe(element.firstElementChild)
    const release = () => { live = false; observer.disconnect() }
    element.addEventListener('touchstart', release, { passive: true, once: true })
    element.addEventListener('wheel', release, { passive: true, once: true })
    element.addEventListener('pointerdown', release, { passive: true, once: true })
    document.fonts.ready.then(() => { if (live) land() })
    landed.current = true
    return () => {
      release()
      element.removeEventListener('touchstart', release); element.removeEventListener('wheel', release); element.removeEventListener('pointerdown', release)
    }
  }, [ready, arriveAtEnd])
  useEffect(() => {
    let live = true
    for (const n of [surah - 1, surah + 1].filter(n => n >= 1 && n <= 114)) {
      loadSurah(n).then(data => { if (live) setNeighbors(current => ({ ...current, [n]: data })) }).catch(() => {})
    }
    return () => { live = false; clearTimeout(timer.current) }
  }, [surah])
  useEffect(() => {
    if (!showTrans) return
    let live = true
    for (const n of [surah - 1, surah + 1].filter(n => n >= 1 && n <= 114)) {
      loadTrans(n).then(data => { if (live) setTranslations(current => ({ ...current, [n]: data })) }).catch(() => {})
    }
    return () => { live = false }
  }, [surah, showTrans])
  useEffect(() => {
    const element = scrollRef.current
    if (!element || !enabled || !ready) return
    let start: { x: number; y: number; edge: number } | null = null
    let distance = 0
    let claimed = false
    let busy = false
    let suppressClickUntil = 0
    const reset = () => { start = null; distance = 0; claimed = false; setSettling(true); setPull(0) }
    const down = (event: TouchEvent) => {
      if (busy) return
      if (event.touches.length !== 1) { reset(); return }
      const touch = event.touches[0]
      const top = element.scrollTop <= 1
      const bottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 2
      start = { x: touch.clientX, y: touch.clientY, edge: top && bottom ? 2 : top ? 1 : bottom ? -1 : 0 }
      distance = 0; claimed = false; setSettling(false)
    }
    const move = (event: TouchEvent) => {
      if (!start || busy) return
      if (event.touches.length !== 1) { reset(); return }
      const dx = event.touches[0].clientX - start.x
      const dy = event.touches[0].clientY - start.y
      if (!claimed && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { start = null; return }
      const direction = dy > 0 ? 1 : -1
      const available = direction > 0 ? surah > 1 : surah < 114
      if (!start.edge || (start.edge !== 2 && start.edge !== direction) || !available) {
        if (claimed) { distance = 0; setPull(0); if (event.cancelable) event.preventDefault() }
        else start = null
        return
      }
      if (!claimed && Math.abs(dy) < 10) return
      claimed = true
      if (event.cancelable) event.preventDefault()
      distance = dy
      setPrevious(dy > 0)
      setPull(dy)
    }
    const end = () => {
      if (claimed) suppressClickUntil = Date.now() + 400
      if (!claimed || busy) { reset(); return }
      if (Math.abs(distance) < THRESHOLD) { reset(); return }
      busy = true
      const previous = distance > 0
      setSettling(true); setCommitting(true)
      setPull((previous ? 1 : -1) * Math.max(280, element.clientHeight))
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      timer.current = setTimeout(async () => {
        try {
          await navigate.current(surah + (previous ? -1 : 1), previous)
        } catch {
          // A failed load leaves the current surah in place and allows a new pull.
          busy = false; setCommitting(false); reset()
        }
      }, reduced ? 0 : 240)
    }
    const cancel = () => { if (!busy) reset() }
    const click = (event: MouseEvent) => { if (claimed || busy || Date.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation() } }
    element.addEventListener('touchstart', down, { passive: true })
    element.addEventListener('touchmove', move, { passive: false })
    element.addEventListener('touchend', end)
    element.addEventListener('touchcancel', cancel)
    element.addEventListener('click', click, true)
    return () => {
      element.removeEventListener('touchstart', down); element.removeEventListener('touchmove', move)
      element.removeEventListener('touchend', end); element.removeEventListener('touchcancel', cancel)
      element.removeEventListener('click', click, true)
    }
  }, [enabled, ready, surah])
  const target = surah + (previous ? -1 : 1)
  const progress = Math.min(1, Math.abs(pull) / THRESHOLD)
  const offset = committing ? pull : Math.sign(pull) * Math.min(180, Math.abs(pull) * 0.65)
  return <div className="surah-pull-shell flex-1 min-h-0 relative overflow-hidden">
    {[surah - 1, surah + 1].filter(n => n >= 1 && n <= 114).map(n => {
      const isPrevious = n < surah
      const active = n === target
      return <div key={n} data-preview-surah={n} aria-hidden="true" className={`surah-pull-preview ${isPrevious ? 'surah-pull-previous' : 'surah-pull-next'}`}
        style={{ opacity: active ? progress : 0, transition: settling ? 'opacity 240ms ease, transform 240ms cubic-bezier(.22,.68,0,1)' : 'none', transform: `translateY(calc(${isPrevious ? '-100%' : '100%'} + ${active ? offset : 0}px))` }}>
        <div className="surah-pull-preview-surface">
          {neighbors[n] && <FlowSurface><AdjacentFlowPage sm={meta[n - 1]} surah={neighbors[n]} trans={translations[n] ?? null} showTrans={showTrans} translator={translator} fontSize={fontSize} selection={null} highlightRoot={null} flash={null} onWordTap={ignoreWordTap} /></FlowSurface>}
        </div>
        <div className="surah-pull-hint" style={{ fontSize: fontSize * 0.55 }}>
          {progress >= 1
            ? `برای رفتن به سورهٔ ${meta[n - 1].fa} رها کنید`
            : `برای دیدن سورهٔ ${meta[n - 1].fa} ${isPrevious ? 'بیشتر پایین' : 'بیشتر بالا'} بکشید`}
        </div>
      </div>
    })}
    <div ref={scrollRef} data-reading-scroll className="surah-pull-scroll h-full overflow-y-auto nice-scroll" style={{ overscrollBehaviorY: 'contain' }}>
      <div className="surah-pull-content min-h-full" data-pull-ready={progress >= 1 && !committing ? 'true' : 'false'} style={{ transform: `translate3d(0, ${offset}px, 0)`, transition: settling ? 'transform 240ms cubic-bezier(.22,.68,0,1)' : 'none' }}>{children}</div>
    </div>
  </div>
}
