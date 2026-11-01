'use client'

import { useRef } from 'react'

type Props = { pane: 'navigation' | 'analysis'; edge: 'start' | 'end'; min: number; max: number }

/** Shared desktop splitter. It stores a bounded width and updates the reader layout atomically. */
export default function DesktopPaneResizeHandle({ pane, edge, min, max }: Props) {
  const drag = useRef<{ x: number; width: number; direction: string } | null>(null)
  const variable = pane === 'navigation' ? '--desktop-navigation-width' : '--desktop-analysis-width'
  const storage = `mushaf.desktop-${pane}-width`
  const finish = () => { drag.current = null; document.body.classList.remove('desktop-pane-resizing') }
  return <div className={`desktop-pane-resize-handle desktop-pane-resize-${edge}`} role="separator" aria-orientation="vertical" tabIndex={0}
    onPointerDown={event => {
      if (event.button !== 0) return
      const app = event.currentTarget.closest<HTMLElement>('.reader-app') ?? document.querySelector<HTMLElement>('.reader-app')
      if (!app) return
      const width = parseFloat(getComputedStyle(app).getPropertyValue(variable)) || min
      drag.current = { x: event.clientX, width, direction: getComputedStyle(app).direction }
      event.currentTarget.setPointerCapture(event.pointerId)
      document.body.classList.add('desktop-pane-resizing')
    }}
    onPointerMove={event => {
      const state = drag.current
      const app = event.currentTarget.closest<HTMLElement>('.reader-app') ?? document.querySelector<HTMLElement>('.reader-app')
      if (!state || !app) return
      const sign = edge === 'start' ? (state.direction === 'rtl' ? -1 : 1) : (state.direction === 'rtl' ? 1 : -1)
      const width = Math.min(max, Math.max(min, Math.round(state.width + (event.clientX - state.x) * sign)))
      app.style.setProperty(variable, `${width}px`)
      try { localStorage.setItem(storage, String(width)) } catch {}
    }}
    onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
    onKeyDown={event => {
      const app = event.currentTarget.closest<HTMLElement>('.reader-app') ?? document.querySelector<HTMLElement>('.reader-app')
      if (!app || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return
      event.preventDefault()
      const current = parseFloat(getComputedStyle(app).getPropertyValue(variable)) || min
      const direction = getComputedStyle(app).direction
      const sign = edge === 'start' ? (direction === 'rtl' ? -1 : 1) : (direction === 'rtl' ? 1 : -1)
      const width = event.key === 'Home' ? min : event.key === 'End' ? max : Math.min(max, Math.max(min, current + (event.key === 'ArrowRight' ? 16 : -16) * sign))
      app.style.setProperty(variable, `${width}px`)
      try { localStorage.setItem(storage, String(width)) } catch {}
    }} />
}
