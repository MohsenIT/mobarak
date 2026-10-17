'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { AnalysisTab } from '@/lib/analysis'

/** Real, independently scrollable tab pages, revealed by a horizontal drag. */
export default function SwipeTabPages({ active, panes, onChange }: {
  active: AnalysisTab
  panes: { key: AnalysisTab; content: ReactNode }[]
  onChange: (tab: AnalysisTab) => void
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const change = useRef(onChange)
  change.current = onChange
  const keys = panes.map(pane => pane.key).join(',')
  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const tabs = keys.split(',') as AnalysisTab[]
    const index = tabs.indexOf(active)
    let start: { x: number; y: number; id: number } | null = null
    let distance = 0
    let locked = false
    let busy = false
    let suppressClickUntil = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const reset = () => { start = null; locked = false; distance = 0; setDragging(false); setOffset(0) }
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
      const neighbor = tabs[index + (dx > 0 ? 1 : -1)]
      setOffset(neighbor ? Math.max(-element.clientWidth, Math.min(element.clientWidth, dx)) : dx * 0.15)
    }
    const end = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return
      if (!locked) { reset(); return }
      suppressClickUntil = Date.now() + 400
      const next = tabs[index + (distance > 0 ? 1 : -1)]
      const threshold = Math.min(96, element.clientWidth * 0.25)
      if (!next || Math.abs(distance) < threshold) { reset(); return }
      busy = true; start = null; setDragging(false)
      setOffset((distance > 0 ? 1 : -1) * element.clientWidth)
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      timer = setTimeout(() => { change.current(next); setOffset(0) }, reduced ? 0 : 220)
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
      const selected = pane.key === active
      const progress = Math.min(1, Math.abs(offset) / width)
      return <div key={pane.key} id={`analysis-panel-${pane.key}`} role={selected ? 'tabpanel' : undefined}
        aria-labelledby={`analysis-tab-${pane.key}`} aria-hidden={!selected} inert={!selected}
        className="swipe-tab-page absolute inset-0 overflow-y-auto nice-scroll px-5 py-4"
        data-tab-page={pane.key}
        style={{ background: 'var(--paper)', overscrollBehavior: 'contain', touchAction: 'pan-y',
          transform: `translate3d(calc(${(index - i) * 100}% + ${offset}px), 0, 0)`,
          transition: dragging ? 'none' : 'transform 220ms cubic-bezier(.22,.68,0,1), opacity 220ms ease',
          opacity: selected ? 1 : 0.6 + progress * 0.4 }}>
        {pane.content}
      </div>
    })}
  </div>
}
