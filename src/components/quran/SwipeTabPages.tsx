'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type ComponentProps } from 'react'
import type { AnalysisTab } from '@/lib/analysis'
import { readAnalysisView, saveAnalysisView } from '@/lib/analysis-view'

export type TabSwipeMotion = { from: AnalysisTab; to: AnalysisTab; progress: number; dragging: boolean; wrap: boolean; settled?: boolean }

/** Real, independently scrollable tab pages, revealed by a horizontal drag. */
export default function SwipeTabPages({ active, panes, onChange, onProgress, contentKey }: {
  active: AnalysisTab
  contentKey: string
  panes: { key: AnalysisTab; content: ReactNode }[]
  onChange: (tab: AnalysisTab) => void
  onProgress?: (motion: TabSwipeMotion) => void
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const change = useRef(onChange)
  change.current = onChange
  const progress = useRef(onProgress)
  progress.current = onProgress
  const keys = panes.map(pane => pane.key).join(',')
  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const tabs = keys.split(',') as AnalysisTab[]
    const index = tabs.indexOf(active)
    const neighborAt = (dx: number) => tabs[(index + (dx > 0 ? 1 : -1) + tabs.length) % tabs.length]
    let start: { x: number; y: number; id: number } | null = null
    let distance = 0
    let locked = false
    let busy = false
    let suppressClickUntil = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const paintProgress = (dx: number, dragging: boolean, fraction = Math.min(1, Math.abs(dx) / element.clientWidth)) => {
      const next = neighborAt(dx) ?? active
      const nextIndex = tabs.indexOf(next)
      const wrap = dx < 0 ? index === 0 && nextIndex === tabs.length - 1 : index === tabs.length - 1 && nextIndex === 0
      progress.current?.({ from: active, to: next, progress: fraction, dragging, wrap })
    }
    const reset = () => { const dx = distance; start = null; locked = false; distance = 0; setDragging(false); setOffset(0); paintProgress(dx, false, 0) }
    reset()
    const down = (event: PointerEvent) => {
      if (busy) return
      if (!event.isPrimary) { reset(); return }
      if (event.button !== 0 || (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]'))) return
      start = { x: event.clientX, y: event.clientY, id: event.pointerId }
      distance = 0; locked = false
    }
    const move = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id || busy) return
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      if (!locked) {
        if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { reset(); return }
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.3) return
        locked = true
        element.setPointerCapture(event.pointerId)
        setDragging(true)
      }
      event.preventDefault()
      distance = dx
      const neighbor = neighborAt(dx)
      setOffset(neighbor ? Math.max(-element.clientWidth, Math.min(element.clientWidth, dx)) : dx * 0.15)
      paintProgress(dx, true)
    }
    const end = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return
      if (!locked) { reset(); return }
      suppressClickUntil = Date.now() + 400
      const next = neighborAt(distance)
      const threshold = Math.min(96, element.clientWidth * 0.25)
      if (!next || Math.abs(distance) < threshold) { reset(); return }
      busy = true; start = null; setDragging(false)
      setOffset((distance > 0 ? 1 : -1) * element.clientWidth)
      paintProgress(distance, false, 1)
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      timer = setTimeout(() => { progress.current?.({ from: next, to: next, progress: 0, dragging: false, wrap: false, settled: true }); change.current(next); setOffset(0) }, reduced ? 0 : 220)
    }
    const cancel = () => { if (!busy) { if (locked) suppressClickUntil = Date.now() + 400; reset() } }
    const click = (event: MouseEvent) => {
      if (busy || locked || Date.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation() }
    }
    element.addEventListener('pointerdown', down)
    element.addEventListener('pointermove', move, { passive: false })
    element.addEventListener('pointerup', end)
    element.addEventListener('pointercancel', cancel)
    element.addEventListener('click', click, true)
    return () => {
      clearTimeout(timer)
      element.removeEventListener('pointerdown', down); element.removeEventListener('pointermove', move)
      element.removeEventListener('pointerup', end); element.removeEventListener('pointercancel', cancel)
      element.removeEventListener('click', click, true)
    }
  }, [active, keys])
  const index = panes.findIndex(pane => pane.key === active)
  const width = viewport.current?.clientWidth ?? 1
  return <div ref={viewport} className="relative flex-1 min-h-0 overflow-hidden" data-tab-pages style={{ touchAction: 'pan-y' }}>
    {panes.map((pane, i) => {
      let relative = index - i
      if (relative > panes.length / 2) relative -= panes.length
      if (relative < -panes.length / 2) relative += panes.length
      // Place an opposite page behind the neighbor being revealed, never across the viewport.
      if (panes.length % 2 === 0 && Math.abs(relative) === panes.length / 2 && offset) relative = offset > 0 ? -panes.length / 2 : panes.length / 2
      const selected = pane.key === active
      const progress = Math.min(1, Math.abs(offset) / width)
      return <PersistentTabPage key={pane.key} tab={pane.key} contentKey={contentKey} id={`analysis-panel-${pane.key}`} role={selected ? 'tabpanel' : undefined}
        aria-labelledby={`analysis-tab-${pane.key}`} aria-hidden={!selected} inert={!selected}
        className="swipe-tab-page absolute inset-0 overflow-y-auto nice-scroll px-5 py-4"
        data-tab-page={pane.key}
        style={{ background: 'var(--paper)', overscrollBehavior: 'contain', touchAction: 'pan-y',
          transform: `translate3d(calc(${relative * 100}% + ${offset}px), 0, 0)`,
          transition: dragging || Math.abs(relative) > 1 ? 'none' : 'transform 220ms cubic-bezier(.22,.68,0,1), opacity 220ms ease',
          opacity: selected ? 1 : 0.6 + progress * 0.4 }}>
        <div data-analysis-scroll-content>{pane.content}</div>
      </PersistentTabPage>
    })}
  </div>
}


/** Restore after async sources expand, without treating loading-time clamps as user scrolls. */
function PersistentTabPage({ tab, contentKey, children, ...props }: ComponentProps<'div'> & { tab: AnalysisTab; contentKey: string }) {
  const page = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = page.current
    if (!element) return
    let top = readAnalysisView().scroll?.[tab] ?? 0
    let restoring = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const restore = () => { if (restoring) element.scrollTop = top }
    const flush = () => { clearTimeout(timer); saveAnalysisView({ scroll: { [tab]: top } }) }
    const intent = () => { restoring = false }
    const scroll = () => {
      if (restoring) return
      top = element.scrollTop
      clearTimeout(timer); timer = setTimeout(flush, 120)
    }
    restore()
    const resize = new ResizeObserver(restore)
    const content = element.querySelector('[data-analysis-scroll-content]')
    if (content) resize.observe(content)
    element.addEventListener('scroll', scroll)
    element.addEventListener('wheel', intent, { passive: true })
    element.addEventListener('touchmove', intent, { passive: true })
    element.addEventListener('keydown', intent)
    return () => {
      flush(); resize.disconnect()
      element.removeEventListener('scroll', scroll); element.removeEventListener('wheel', intent)
      element.removeEventListener('touchmove', intent); element.removeEventListener('keydown', intent)
    }
  }, [tab, contentKey])
  return <div {...props} ref={page}>{children}</div>
}
